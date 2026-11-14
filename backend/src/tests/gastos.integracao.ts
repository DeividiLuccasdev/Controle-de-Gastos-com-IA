// Testes de integração: API real (Express + Prisma) contra um PostgreSQL
// real; só a IA é substituída por um dublê.
// Rodar com: DATABASE_URL=... npm run test:integracao
import "./ambiente";

import assert from "node:assert/strict";
import fs from "node:fs";
import { after, beforeEach, describe, test } from "node:test";
import request from "supertest";
import sharp from "sharp";

import { criarApp } from "../app";
import { prisma } from "../config/prisma";
import { resolverImagem } from "../config/upload";
import {
  IATempoEsgotado,
  ResultadoComprovante
} from "../services/analisarComprovante";
import { limparUploadsOrfaos } from "../services/imagens";

const analiseOk: ResultadoComprovante = {
  estabelecimento: "Mercado Teste",
  dataCompra: "2026-11-10",
  total: 42.5,
  categoria: "Mercado",
  itens: [{ produto: "Arroz", quantidade: 1, valorUnitario: 42.5, valorTotal: 42.5 }]
};

// Comportamento da IA em cada teste.
let ia: (caminho: string) => Promise<ResultadoComprovante> = async () => analiseOk;
const app = criarApp({ analisarComprovante: (caminho) => ia(caminho) });

async function imagemDeTeste(cor = "#ff0000") {
  return sharp({
    create: { width: 16, height: 16, channels: 3, background: cor }
  }).png().toBuffer();
}

let contador = 0;

async function criarUsuario() {
  const email = `teste${++contador}-${Date.now()}@exemplo.com`;
  const cadastro = await request(app)
    .post("/usuarios")
    .send({ nome: "Teste", email, senha: "123456" });
  assert.equal(cadastro.status, 201);

  const login = await request(app).post("/auth/login").send({ email, senha: "123456" });
  assert.equal(login.status, 200);

  return { id: cadastro.body.usuario.id as number, token: login.body.token as string };
}

async function enviarFoto(token: string, conteudo: Buffer) {
  const resposta = await request(app)
    .post("/gastos/foto")
    .set("Authorization", `Bearer ${token}`)
    .attach("comprovante", conteudo, { filename: "nota.png", contentType: "image/png" });
  assert.equal(resposta.status, 201);
  return resposta.body.imagemUrl as string;
}

function arquivoExiste(imagemUrl: string, usuarioId: number) {
  const caminho = resolverImagem(imagemUrl, usuarioId);
  assert.ok(caminho);
  return fs.existsSync(caminho);
}

function semDetalheInterno(corpo: Record<string, unknown>) {
  assert.equal(corpo.detalhe, undefined);
  assert.equal(Object.keys(corpo).join(","), "mensagem");
}

const corpoGasto = (imagemUrl: string) => ({
  estabelecimento: "Mercado Teste",
  total: 10,
  categoria: "Mercado",
  dataCompra: "2026-11-10",
  imagemUrl,
  itens: [{ produto: "Pão", quantidade: 2, valorUnitario: 5 }]
});

beforeEach(async () => {
  ia = async () => analiseOk;
  await prisma.$executeRawUnsafe(
    'TRUNCATE "ItemGasto", "Gasto", "Usuario" RESTART IDENTITY CASCADE'
  );
});

after(async () => {
  await prisma.$disconnect();
  fs.rmSync(process.env.UPLOADS_DIR!, { recursive: true, force: true });
});

describe("idempotência ao salvar gastos", () => {
  test("dois salvamentos simultâneos do mesmo comprovante criam um único gasto", async () => {
    const { id, token } = await criarUsuario();
    const imagemUrl = await enviarFoto(token, await imagemDeTeste());

    const respostas = await Promise.all(
      Array.from({ length: 5 }, () =>
        request(app)
          .post("/gastos")
          .set("Authorization", `Bearer ${token}`)
          .send(corpoGasto(imagemUrl))
      )
    );

    const status = respostas.map((r) => r.status).sort();
    assert.deepEqual(status, [200, 200, 200, 200, 201]);

    const ids = new Set(respostas.map((r) => r.body.gasto.id));
    assert.equal(ids.size, 1, "todas as respostas devem devolver o mesmo gasto");

    assert.equal(await prisma.gasto.count({ where: { usuarioId: id } }), 1);
    assert.equal(await prisma.itemGasto.count(), 1);
  });

  test("a mesma foto enviada duas vezes devolve o gasto existente e descarta o arquivo repetido", async () => {
    const { id, token } = await criarUsuario();
    const foto = await imagemDeTeste("#00ff00");

    const primeira = await enviarFoto(token, foto);
    const segunda = await enviarFoto(token, foto);
    assert.notEqual(primeira, segunda);

    const r1 = await request(app)
      .post("/gastos")
      .set("Authorization", `Bearer ${token}`)
      .send(corpoGasto(primeira));
    assert.equal(r1.status, 201);

    const r2 = await request(app)
      .post("/gastos")
      .set("Authorization", `Bearer ${token}`)
      .send(corpoGasto(segunda));
    assert.equal(r2.status, 200);
    assert.equal(r2.body.duplicado, true);
    assert.equal(r2.body.gasto.id, r1.body.gasto.id);

    assert.equal(await prisma.gasto.count({ where: { usuarioId: id } }), 1);
    assert.equal(arquivoExiste(primeira, id), true);
    assert.equal(arquivoExiste(segunda, id), false);
  });

  test("analisar-e-salvar repetido devolve o mesmo gasto", async () => {
    const { id, token } = await criarUsuario();
    const imagemUrl = await enviarFoto(token, await imagemDeTeste("#0000ff"));

    const [a, b] = await Promise.all(
      [1, 2].map(() =>
        request(app)
          .post("/gastos/analisar-e-salvar")
          .set("Authorization", `Bearer ${token}`)
          .send({ imagemUrl })
      )
    );

    assert.deepEqual([a.status, b.status].sort(), [200, 201]);
    assert.equal(a.body.gasto.id, b.body.gasto.id);
    assert.equal(await prisma.gasto.count({ where: { usuarioId: id } }), 1);
    assert.equal(arquivoExiste(imagemUrl, id), true);
  });

  test("gastos manuais sem imagem continuam podendo se repetir", async () => {
    const { token } = await criarUsuario();

    for (let i = 0; i < 2; i++) {
      const r = await request(app)
        .post("/gastos")
        .set("Authorization", `Bearer ${token}`)
        .send({ total: 5 });
      assert.equal(r.status, 201);
    }

    assert.equal(await prisma.gasto.count(), 2);
  });
});

describe("falhas não deixam arquivos órfãos nem vazam detalhes", () => {
  test("IA lança erro: 500 genérico e arquivo removido", async () => {
    const { id, token } = await criarUsuario();
    const imagemUrl = await enviarFoto(token, await imagemDeTeste());
    ia = async () => {
      throw new Error("segredo interno: conexão recusada em 10.0.0.5");
    };

    for (const rota of ["/gastos/analisar", "/gastos/analisar-e-salvar"]) {
      const url = rota.endsWith("salvar") ? await enviarFoto(token, await imagemDeTeste("#123456")) : imagemUrl;
      const r = await request(app)
        .post(rota)
        .set("Authorization", `Bearer ${token}`)
        .send({ imagemUrl: url });

      assert.equal(r.status, 500, rota);
      semDetalheInterno(r.body);
      assert.doesNotMatch(JSON.stringify(r.body), /segredo|10\.0\.0\.5/);
      assert.equal(arquivoExiste(url, id), false, rota);
    }
  });

  test("IA demora demais: 504 e arquivo removido", async () => {
    const { id, token } = await criarUsuario();
    const imagemUrl = await enviarFoto(token, await imagemDeTeste());
    ia = async () => {
      throw new IATempoEsgotado("A análise por IA demorou demais. Tente novamente.");
    };

    const r = await request(app)
      .post("/gastos/analisar-e-salvar")
      .set("Authorization", `Bearer ${token}`)
      .send({ imagemUrl });

    assert.equal(r.status, 504);
    semDetalheInterno(r.body);
    assert.equal(arquivoExiste(imagemUrl, id), false);
    assert.equal(await prisma.gasto.count(), 0);
  });

  test("IA não encontra o total: 422 e arquivo removido", async () => {
    const { id, token } = await criarUsuario();
    const imagemUrl = await enviarFoto(token, await imagemDeTeste());
    ia = async () => ({ ...analiseOk, total: null });

    const r = await request(app)
      .post("/gastos/analisar-e-salvar")
      .set("Authorization", `Bearer ${token}`)
      .send({ imagemUrl });

    assert.equal(r.status, 422);
    assert.equal(arquivoExiste(imagemUrl, id), false);
  });

  test("erro no banco ao criar o gasto: 500 genérico, sem gasto e arquivo removido", async () => {
    const { id, token } = await criarUsuario();
    const imagemUrl = await enviarFoto(token, await imagemDeTeste());
    // Valor maior que DECIMAL(10,2): o PostgreSQL rejeita o INSERT.
    ia = async () => ({ ...analiseOk, total: 1e12 });

    const r = await request(app)
      .post("/gastos/analisar-e-salvar")
      .set("Authorization", `Bearer ${token}`)
      .send({ imagemUrl });

    assert.equal(r.status, 500);
    semDetalheInterno(r.body);
    assert.equal(await prisma.gasto.count(), 0);
    assert.equal(arquivoExiste(imagemUrl, id), false);
  });

  test("cancelar a análise descarta a foto (e repetir não dá erro)", async () => {
    const { id, token } = await criarUsuario();
    const imagemUrl = await enviarFoto(token, await imagemDeTeste());

    for (let i = 0; i < 2; i++) {
      const r = await request(app)
        .delete("/gastos/foto")
        .set("Authorization", `Bearer ${token}`)
        .send({ imagemUrl });
      assert.equal(r.status, 204);
    }

    assert.equal(arquivoExiste(imagemUrl, id), false);
  });

  test("descartar foto não apaga imagem de um gasto salvo", async () => {
    const { id, token } = await criarUsuario();
    const imagemUrl = await enviarFoto(token, await imagemDeTeste());
    await request(app)
      .post("/gastos")
      .set("Authorization", `Bearer ${token}`)
      .send(corpoGasto(imagemUrl));

    const r = await request(app)
      .delete("/gastos/foto")
      .set("Authorization", `Bearer ${token}`)
      .send({ imagemUrl });

    assert.equal(r.status, 204);
    assert.equal(arquivoExiste(imagemUrl, id), true);
  });

  test("limpeza periódica remove só arquivos antigos sem gasto", async () => {
    const { id, token } = await criarUsuario();
    const usada = await enviarFoto(token, await imagemDeTeste("#111111"));
    const orfa = await enviarFoto(token, await imagemDeTeste("#222222"));
    await request(app)
      .post("/gastos")
      .set("Authorization", `Bearer ${token}`)
      .send(corpoGasto(usada));

    // Arquivos recentes não entram (o usuário pode estar conferindo a análise).
    assert.equal(await limparUploadsOrfaos(), 0);

    const removidos = await limparUploadsOrfaos(0, Date.now() + 1000);
    assert.equal(removidos, 1);
    assert.equal(arquivoExiste(usada, id), true);
    assert.equal(arquivoExiste(orfa, id), false);
  });
});

describe("cadastro concorrente", () => {
  test("dois cadastros simultâneos com o mesmo e-mail: 201 e 409", async () => {
    const respostas = await Promise.all(
      ["Corrida@Exemplo.com", "corrida@exemplo.com "].map((email) =>
        request(app).post("/usuarios").send({ nome: "X", email, senha: "123456" })
      )
    );

    assert.deepEqual(respostas.map((r) => r.status).sort(), [201, 409]);
    assert.equal(await prisma.usuario.count(), 1);

    const login = await request(app)
      .post("/auth/login")
      .send({ email: "CORRIDA@exemplo.com", senha: "123456" });
    assert.equal(login.status, 200);
  });
});

describe("exclusão idempotente e total pelo servidor", () => {
  test("excluir remove o arquivo; repetir a exclusão responde 204", async () => {
    const { id, token } = await criarUsuario();
    const imagemUrl = await enviarFoto(token, await imagemDeTeste());
    const salvo = await request(app)
      .post("/gastos")
      .set("Authorization", `Bearer ${token}`)
      .send(corpoGasto(imagemUrl));

    for (let i = 0; i < 2; i++) {
      const r = await request(app)
        .delete(`/gastos/${salvo.body.gasto.id}`)
        .set("Authorization", `Bearer ${token}`);
      assert.equal(r.status, 204);
    }

    assert.equal(await prisma.gasto.count(), 0);
    assert.equal(arquivoExiste(imagemUrl, id), false);
  });

  test("não exclui gasto de outro usuário (e não revela que ele existe)", async () => {
    const dono = await criarUsuario();
    const outro = await criarUsuario();
    const salvo = await request(app)
      .post("/gastos")
      .set("Authorization", `Bearer ${dono.token}`)
      .send({ total: 7 });

    const r = await request(app)
      .delete(`/gastos/${salvo.body.gasto.id}`)
      .set("Authorization", `Bearer ${outro.token}`);

    assert.equal(r.status, 204);
    assert.equal(await prisma.gasto.count(), 1);
  });

  test("resumo soma os gastos no banco", async () => {
    const { token } = await criarUsuario();
    for (const total of [10.1, 20.2, 0.3]) {
      await request(app)
        .post("/gastos")
        .set("Authorization", `Bearer ${token}`)
        .send({ total });
    }

    const r = await request(app)
      .get("/gastos/resumo")
      .set("Authorization", `Bearer ${token}`);

    assert.equal(r.status, 200);
    assert.equal(r.body.total, "30.6");
    assert.equal(r.body.quantidade, 3);
  });
});
