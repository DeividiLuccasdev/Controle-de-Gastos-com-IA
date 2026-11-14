// Conta pública de demonstração (seed:demo) contra um PostgreSQL real.
import "./ambiente";

import assert from "node:assert/strict";
import { after, beforeEach, describe, test } from "node:test";
import bcrypt from "bcryptjs";
import express from "express";
import request from "supertest";

import { criarApp } from "../app";
import { prisma } from "../config/prisma";
import {
  bloquearContaDemo,
  EMAIL_DEMO,
  garantirUsuarioDemo,
  NOME_DEMO,
  SENHA_DEMO
} from "../services/usuarioDemo";

const app = criarApp({
  analisarComprovante: async () => {
    throw new Error("IA não deve ser chamada nestes testes.");
  }
});

const comSeed = { CRIAR_USUARIO_DEMO: "true" } as NodeJS.ProcessEnv;

function login(senha = SENHA_DEMO) {
  return request(app).post("/auth/login").send({ email: EMAIL_DEMO, senha });
}

beforeEach(async () => {
  await prisma.$executeRawUnsafe(
    'TRUNCATE "ItemGasto", "Gasto", "Usuario" RESTART IDENTITY CASCADE'
  );
});

after(async () => {
  await prisma.$disconnect();
});

describe("conta de demonstração", () => {
  test("sem RENDER nem CRIAR_USUARIO_DEMO o seed não faz nada", async () => {
    const resultado = await garantirUsuarioDemo({} as NodeJS.ProcessEnv);

    assert.deepEqual(resultado, { executado: false });
    assert.equal(await prisma.usuario.count(), 0);

    const falsa = await garantirUsuarioDemo({ CRIAR_USUARIO_DEMO: "false" } as NodeJS.ProcessEnv);
    assert.deepEqual(falsa, { executado: false });
    assert.equal(await prisma.usuario.count(), 0);
  });

  test("com RENDER definido cria a conta e o login funciona", async () => {
    const resultado = await garantirUsuarioDemo({ RENDER: "true" } as NodeJS.ProcessEnv);

    assert.equal(resultado.executado, true);
    const r = await login();
    assert.equal(r.status, 200);
    assert.equal(r.body.usuario.nome, NOME_DEMO);
    assert.equal(r.body.usuario.email, EMAIL_DEMO);
  });

  test("é idempotente: rodar várias vezes (inclusive juntas) mantém uma conta e os mesmos gastos", async () => {
    await Promise.all([garantirUsuarioDemo(comSeed), garantirUsuarioDemo(comSeed)]);
    const segunda = await garantirUsuarioDemo(comSeed);

    assert.equal(await prisma.usuario.count({ where: { email: EMAIL_DEMO } }), 1);
    assert.equal(segunda.executado && segunda.gastosCriados, 0);

    const gastos = await prisma.gasto.count();
    assert.ok(gastos >= 5 && gastos <= 8, `esperava 5 a 8 gastos, veio ${gastos}`);
  });

  test("insere os gastos de exemplo uma única vez e eles aparecem para a conta", async () => {
    const primeira = await garantirUsuarioDemo(comSeed);
    assert.ok(primeira.executado);
    assert.ok(primeira.gastosCriados > 0);

    const { token } = (await login()).body;
    const lista = await request(app).get("/gastos").set("Authorization", `Bearer ${token}`);
    assert.equal(lista.status, 200);
    assert.equal(lista.body.length, primeira.gastosCriados);
    assert.ok(lista.body.every((g: { imagemUrl: unknown }) => g.imagemUrl === null));

    // Se o visitante apagar um gasto, o próximo deploy não recria os exemplos.
    await request(app)
      .delete(`/gastos/${lista.body[0].id}`)
      .set("Authorization", `Bearer ${token}`);
    const depois = await garantirUsuarioDemo(comSeed);
    assert.equal(depois.executado && depois.gastosCriados, 0);
    assert.equal(await prisma.gasto.count(), lista.body.length - 1);
  });

  test("redefine a senha e o nome se a conta foi alterada", async () => {
    await garantirUsuarioDemo(comSeed);
    await prisma.usuario.update({
      where: { email: EMAIL_DEMO },
      data: { nome: "Vandalizado", senha: await bcrypt.hash("outra-senha", 10) }
    });
    assert.equal((await login()).status, 401);

    await garantirUsuarioDemo(comSeed);

    const r = await login();
    assert.equal(r.status, 200);
    assert.equal(r.body.usuario.nome, NOME_DEMO);
  });

  test("não é possível se cadastrar com o e-mail da demo", async () => {
    await garantirUsuarioDemo(comSeed);

    for (const email of [EMAIL_DEMO, " Demo@Example.com "]) {
      const r = await request(app)
        .post("/usuarios")
        .send({ nome: "Intruso", email, senha: "123456" });
      assert.equal(r.status, 409);
    }

    assert.equal((await login()).status, 200);
  });

  test("bloquearContaDemo responde 403 só para a conta demo", async () => {
    const rotas = express();
    rotas.post("/alterar", express.json(), (req, res) => {
      if (bloquearContaDemo(req.body.email, res)) return;
      res.status(204).end();
    });

    const demo = await request(rotas).post("/alterar").send({ email: "DEMO@example.com" });
    assert.equal(demo.status, 403);
    assert.match(demo.body.mensagem, /demonstração/);

    const outro = await request(rotas).post("/alterar").send({ email: "alguem@exemplo.com" });
    assert.equal(outro.status, 204);
  });
});
