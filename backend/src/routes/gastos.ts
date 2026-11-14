import fs from "fs/promises";
import { NextFunction, Request, Response, Router } from "express";
import multer from "multer";

import { prisma } from "../config/prisma";
import {
  hashDaImagem,
  removerArquivo,
  resolverImagem,
  salvarImagem,
  upload
} from "../config/upload";
import {
  Analisador,
  analisarComprovante as analisadorPadrao
} from "../services/analisarComprovante";
import { descartarImagemSeOrfa } from "../services/imagens";
import { codigoPrisma, responderErro } from "../utils/erros";

import {
  autenticar,
  AuthRequest
} from "../middlewares/autenticacao";

// Recebe o arquivo "comprovante" e responde 400 (em JSON) para
// arquivo grande demais ou formato não permitido.
function receberComprovante(
  req: Request,
  res: Response,
  next: NextFunction
) {
  upload.single("comprovante")(req, res, (erro: unknown) => {
    if (!erro) {
      return next();
    }

    const mensagem =
      erro instanceof multer.MulterError && erro.code === "LIMIT_FILE_SIZE"
        ? "A imagem deve ter no máximo 10 MB."
        : erro instanceof Error
          ? erro.message
          : "Erro ao receber o arquivo.";

    return res.status(400).json({ mensagem });
  });
}

// Caminho da imagem do usuário, ou null se o imagemUrl for inválido,
// de outro usuário ou se o arquivo não existir. A existência aqui é só
// uma validação antecipada: quem lê o arquivo depois trata o ENOENT.
async function caminhoDaImagem(imagemUrl: unknown, usuarioId: number) {
  const caminho = resolverImagem(imagemUrl, usuarioId);

  if (!caminho) return null;

  try {
    await fs.access(caminho);
    return caminho;
  } catch {
    return null;
  }
}

type DadosGasto = {
  estabelecimento?: string | null;
  total: unknown;
  categoria?: string | null;
  dataCompra: Date | null;
  itens: {
    produto: string;
    quantidade: number;
    valorUnitario: unknown;
    valorTotal: unknown;
  }[];
};

// Cria o gasto de forma idempotente. As restrições únicas
// (usuarioId, imagemUrl) e (usuarioId, imagemHash) garantem no banco que
// um duplo clique, um reenvio ou a mesma foto enviada de novo não gere
// dois gastos — mesmo com requisições simultâneas. Nesse caso devolve o
// gasto que já existia.
async function criarGastoIdempotente(
  usuarioId: number,
  dados: DadosGasto,
  imagemUrl: string | null,
  imagemHash: string | null
) {
  try {
    const gasto = await prisma.gasto.create({
      data: {
        estabelecimento: dados.estabelecimento ?? null,
        total: dados.total as number,
        categoria: dados.categoria ?? null,
        dataCompra: dados.dataCompra,
        imagemUrl,
        imagemHash,
        usuarioId,
        itens: {
          create: dados.itens.map((item) => ({
            produto: item.produto,
            quantidade: item.quantidade,
            valorUnitario: item.valorUnitario as number,
            valorTotal: item.valorTotal as number
          }))
        }
      },
      include: { itens: true }
    });

    return { gasto, duplicado: false };
  } catch (erro) {
    if (codigoPrisma(erro) !== "P2002" || !imagemUrl) {
      throw erro;
    }

    const existente = await prisma.gasto.findFirst({
      where: {
        usuarioId,
        OR: [
          { imagemUrl },
          ...(imagemHash ? [{ imagemHash }] : [])
        ]
      },
      include: { itens: true }
    });

    if (!existente) {
      throw erro;
    }

    // Mesma foto enviada duas vezes: o segundo arquivo não será usado.
    if (existente.imagemUrl !== imagemUrl) {
      await descartarImagemSeOrfa(imagemUrl, usuarioId);
    }

    return { gasto: existente, duplicado: true };
  }
}

function responderGastoSalvo(
  res: Response,
  resultado: Awaited<ReturnType<typeof criarGastoIdempotente>>,
  mensagem: string
) {
  if (resultado.duplicado) {
    return res.status(200).json({
      mensagem: "Este comprovante já estava salvo.",
      duplicado: true,
      gasto: resultado.gasto
    });
  }

  return res.status(201).json({ mensagem, gasto: resultado.gasto });
}

export function criarRotasGastos(
  analisarComprovante: Analisador = analisadorPadrao
) {
  const router = Router();

  router.get("/", autenticar, async (req: AuthRequest, res: Response) => {
    try {
      const usuarioId = req.usuarioId;

      if (!usuarioId) {
        return res.status(401).json({
          mensagem: "Usuário não autenticado."
        });
      }

      const gastos = await prisma.gasto.findMany({
        where: {
          usuarioId
        },
        include: {
          itens: true
        },
        orderBy: {
          criadoEm: "desc"
        }
      });

      return res.json(gastos);

    } catch (error) {
      return responderErro(res, error, "ERRO AO BUSCAR GASTOS", "Erro ao buscar gastos.");
    }
  });

  // Total e quantidade calculados pelo banco (não pela lista no navegador,
  // que pode estar desatualizada).
  router.get("/resumo", autenticar, async (req: AuthRequest, res: Response) => {
    try {
      const usuarioId = req.usuarioId;

      if (!usuarioId) {
        return res.status(401).json({ mensagem: "Usuário não autenticado." });
      }

      const resumo = await prisma.gasto.aggregate({
        where: { usuarioId },
        _sum: { total: true },
        _count: { _all: true }
      });

      return res.json({
        total: resumo._sum.total?.toString() ?? "0",
        quantidade: resumo._count._all
      });
    } catch (error) {
      return responderErro(res, error, "ERRO AO RESUMIR GASTOS", "Erro ao buscar resumo.");
    }
  });

  // Descarta uma imagem enviada que não chegou a virar gasto
  // (ex.: o usuário cancelou a análise). Idempotente: responde 204 mesmo
  // se o arquivo já não existir; nunca apaga imagem usada por um gasto.
  router.delete("/foto", autenticar, async (req: AuthRequest, res: Response) => {
    try {
      const usuarioId = req.usuarioId;

      if (!usuarioId) {
        return res.status(401).json({ mensagem: "Usuário não autenticado." });
      }

      const { imagemUrl } = req.body ?? {};

      if (!resolverImagem(imagemUrl, usuarioId)) {
        return res.status(400).json({ mensagem: "Imagem inválida." });
      }

      await descartarImagemSeOrfa(imagemUrl, usuarioId);

      return res.status(204).end();
    } catch (error) {
      return responderErro(res, error, "ERRO AO DESCARTAR IMAGEM", "Erro ao descartar imagem.");
    }
  });

  // Exclui apenas gastos do usuário autenticado.
  // O banco também exclui os ItemGasto associados (relação em cascata).
  // Idempotente: se o gasto já não existe (ex.: requisição repetida),
  // responde 204 do mesmo jeito — e o mesmo vale para id de outro usuário,
  // sem revelar se ele existe.
  router.delete("/:id", autenticar, async (req: AuthRequest, res: Response) => {
    try {
      const usuarioId = req.usuarioId;
      if (!usuarioId) {
        return res.status(401).json({ mensagem: "Usuário não autenticado." });
      }

      const gastoId = Number(req.params.id);
      if (!Number.isSafeInteger(gastoId) || gastoId <= 0) {
        return res.status(400).json({ mensagem: "Identificador do gasto inválido." });
      }

      const gasto = await prisma.gasto.findFirst({
        where: { id: gastoId, usuarioId },
        select: { imagemUrl: true }
      });

      if (gasto) {
        // Primeiro o registro, depois o arquivo: se a exclusão no banco
        // falhar, o gasto continua com a imagem dele.
        const resultado = await prisma.gasto.deleteMany({
          where: { id: gastoId, usuarioId }
        });

        if (resultado.count > 0) {
          const caminho = resolverImagem(gasto.imagemUrl, usuarioId);
          if (caminho) await removerArquivo(caminho);
        }
      }

      return res.status(204).end();
    } catch (error) {
      return responderErro(res, error, "ERRO AO EXCLUIR GASTO", "Erro ao excluir gasto.");
    }
  });

  router.post("/", autenticar, async (req: AuthRequest, res: Response) => {
    try {
      const usuarioId = req.usuarioId;

      if (!usuarioId) {
        return res.status(401).json({
          mensagem: "Usuário não autenticado."
        });
      }

      const {
        estabelecimento,
        total,
        categoria,
        dataCompra,
        imagemUrl,
        itens
      } = req.body ?? {};

      if (total === undefined || total === null) {
        return res.status(400).json({
          mensagem: "O valor total é obrigatório."
        });
      }

      let imagemHash: string | null = null;

      if (imagemUrl) {
        const caminho = await caminhoDaImagem(imagemUrl, usuarioId);

        if (!caminho) {
          return res.status(400).json({
            mensagem: "Imagem inválida."
          });
        }

        imagemHash = await hashDaImagem(caminho);
      }

      const resultado = await criarGastoIdempotente(
        usuarioId,
        {
          estabelecimento,
          total,
          categoria,
          dataCompra: dataCompra ? new Date(dataCompra) : null,
          itens: Array.isArray(itens)
            ? itens.map((item) => ({
                produto: item.produto,
                quantidade: item.quantidade ?? 1,
                valorUnitario: item.valorUnitario,
                valorTotal:
                  item.valorTotal ??
                  Number(item.valorUnitario) *
                  (item.quantidade ?? 1)
              }))
            : []
        },
        imagemUrl || null,
        imagemHash
      );

      return responderGastoSalvo(res, resultado, "Gasto cadastrado com sucesso.");

    } catch (error) {
      // A imagem é mantida para o usuário poder tentar salvar de novo;
      // se ela ficar órfã, a limpeza periódica remove.
      return responderErro(res, error, "ERRO AO CADASTRAR GASTO", "Erro ao cadastrar gasto.");
    }
  });

  router.post(
    "/foto",
    autenticar,
    receberComprovante,
    async (req: AuthRequest, res: Response) => {
      try {
        const usuarioId = req.usuarioId;

        if (!usuarioId) {
          return res.status(401).json({
            mensagem: "Usuário não autenticado."
          });
        }

        if (!req.file) {
          return res.status(400).json({
            mensagem: "Nenhuma imagem foi enviada."
          });
        }

        const { imagemUrl } = await salvarImagem(req.file.buffer, usuarioId);

        return res.status(201).json({
          mensagem: "Comprovante enviado com sucesso.",
          imagemUrl,
          arquivo: imagemUrl.split("/").pop()
        });

      } catch (error) {
        return responderErro(res, error, "ERRO NO UPLOAD", "Erro ao enviar comprovante.");
      }
    }
  );

  router.post(
    "/analisar",
    autenticar,
    async (req: AuthRequest, res: Response) => {
      const usuarioId = req.usuarioId;
      const { imagemUrl } = req.body ?? {};

      try {
        if (!usuarioId) {
          return res.status(401).json({
            mensagem: "Usuário não autenticado."
          });
        }

        if (!imagemUrl) {
          return res.status(400).json({
            mensagem: "imagemUrl é obrigatória."
          });
        }

        const caminhoArquivo = await caminhoDaImagem(imagemUrl, usuarioId);

        if (!caminhoArquivo) {
          return res.status(400).json({
            mensagem: "Imagem inválida."
          });
        }

        const dadosExtraidos =
          await analisarComprovante(caminhoArquivo);

        return res.status(200).json({
          mensagem: "Comprovante analisado com sucesso.",
          dados: dadosExtraidos
        });

      } catch (error) {
        // A análise falhou: a foto enviada não vai virar gasto
        // (o app pede uma nova foto), então não deixa o arquivo para trás.
        if (usuarioId) await descartarImagemSeOrfa(imagemUrl, usuarioId);

        return responderErro(res, error, "ERRO AO ANALISAR COMPROVANTE", "Erro ao analisar comprovante.");
      }
    }
  );

  router.post(
    "/analisar-e-salvar",
    autenticar,
    async (req: AuthRequest, res: Response) => {
      const usuarioId = req.usuarioId;
      const { imagemUrl } = req.body ?? {};

      try {
        if (!usuarioId) {
          return res.status(401).json({
            mensagem: "Usuário não autenticado."
          });
        }

        if (!imagemUrl) {
          return res.status(400).json({
            mensagem: "imagemUrl é obrigatória."
          });
        }

        const caminhoArquivo = await caminhoDaImagem(imagemUrl, usuarioId);

        if (!caminhoArquivo) {
          return res.status(400).json({
            mensagem: "Imagem inválida."
          });
        }

        const imagemHash = await hashDaImagem(caminhoArquivo);
        const dados = await analisarComprovante(caminhoArquivo);

        if (dados.total === null) {
          await descartarImagemSeOrfa(imagemUrl, usuarioId);

          return res.status(422).json({
            mensagem: "Não foi possível identificar o valor total.",
            dados
          });
        }

        const resultado = await criarGastoIdempotente(
          usuarioId,
          {
            estabelecimento: dados.estabelecimento,
            total: dados.total,
            categoria: dados.categoria,
            dataCompra: dados.dataCompra
              ? new Date(`${dados.dataCompra}T12:00:00`)
              : null,
            itens: dados.itens
          },
          imagemUrl,
          imagemHash
        );

        return responderGastoSalvo(
          res,
          resultado,
          "Comprovante analisado e gasto salvo com sucesso."
        );

      } catch (error) {
        if (usuarioId) await descartarImagemSeOrfa(imagemUrl, usuarioId);

        return responderErro(res, error, "ERRO AO ANALISAR E SALVAR", "Erro ao analisar e salvar comprovante.");
      }
    }
  );

  return router;
}
