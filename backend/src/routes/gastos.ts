import fs from "fs";
import { NextFunction, Request, Response, Router } from "express";
import multer from "multer";

import { prisma } from "../config/prisma";
import {
  ImagemInvalidaError,
  resolverImagem,
  salvarImagem,
  upload
} from "../config/upload";
import {
  analisarComprovante,
  IAIndisponivel
} from "../services/analisarComprovante";

import {
  autenticar,
  AuthRequest
} from "../middlewares/autenticacao";

const router = Router();

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
// de outro usuário ou se o arquivo não existir.
function caminhoDaImagem(imagemUrl: unknown, usuarioId: number) {
  const caminho = resolverImagem(imagemUrl, usuarioId);

  return caminho && fs.existsSync(caminho) ? caminho : null;
}

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
    console.error("ERRO AO BUSCAR GASTOS:", error);

    return res.status(500).json({
      mensagem: "Erro ao buscar gastos."
    });
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
    } = req.body;

    if (total === undefined || total === null) {
      return res.status(400).json({
        mensagem: "O valor total é obrigatório."
      });
    }

    if (imagemUrl && !caminhoDaImagem(imagemUrl, usuarioId)) {
      return res.status(400).json({
        mensagem: "Imagem inválida."
      });
    }

    const gasto = await prisma.gasto.create({
      data: {
        estabelecimento,
        total,
        categoria,
        dataCompra: dataCompra ? new Date(dataCompra) : null,
        imagemUrl: imagemUrl || null,
        usuarioId,

        itens: {
          create: Array.isArray(itens)
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
        }
      },

      include: {
        itens: true
      }
    });

    return res.status(201).json({
      mensagem: "Gasto cadastrado com sucesso.",
      gasto
    });

  } catch (error) {
    console.error("ERRO AO CADASTRAR GASTO:", error);

    return res.status(500).json({
      mensagem: "Erro ao cadastrar gasto."
    });
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

      const imagemUrl = await salvarImagem(req.file.buffer, usuarioId);

      return res.status(201).json({
        mensagem: "Comprovante enviado com sucesso.",
        imagemUrl,
        arquivo: imagemUrl.split("/").pop()
      });

    } catch (error) {
      if (error instanceof ImagemInvalidaError) {
        return res.status(400).json({
          mensagem: error.message
        });
      }

      console.error("ERRO NO UPLOAD:", error);

      return res.status(500).json({
        mensagem: "Erro ao enviar comprovante."
      });
    }
  }
);

router.post(
  "/analisar",
  autenticar,
  async (req: AuthRequest, res: Response) => {
    try {
      const usuarioId = req.usuarioId;
      const { imagemUrl } = req.body ?? {};

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

      const caminhoArquivo = caminhoDaImagem(imagemUrl, usuarioId);

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
      if (error instanceof IAIndisponivel) {
        return res.status(503).json({
          mensagem: error.message
        });
      }

      console.error(
        "ERRO AO ANALISAR COMPROVANTE:",
        error
      );

      return res.status(500).json({
        mensagem: "Erro ao analisar comprovante.",
        detalhe:
          error instanceof Error
            ? error.message
            : String(error)
      });
    }
  }
);
router.post(
  "/analisar-e-salvar",
  autenticar,
  async (req: AuthRequest, res: Response) => {
    try {
      const usuarioId = req.usuarioId;
      const { imagemUrl } = req.body ?? {};

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

      const caminhoArquivo = caminhoDaImagem(imagemUrl, usuarioId);

      if (!caminhoArquivo) {
        return res.status(400).json({
          mensagem: "Imagem inválida."
        });
      }

      const dados = await analisarComprovante(caminhoArquivo);

      if (dados.total === null) {
        return res.status(422).json({
          mensagem: "Não foi possível identificar o valor total.",
          dados
        });
      }

      const gasto = await prisma.gasto.create({
        data: {
          estabelecimento: dados.estabelecimento,
          total: dados.total,
          categoria: dados.categoria,

          dataCompra: dados.dataCompra
            ? new Date(`${dados.dataCompra}T12:00:00`)
            : null,

          imagemUrl,
          usuarioId,

          itens: {
            create: dados.itens.map((item) => ({
              produto: item.produto,
              quantidade: item.quantidade,
              valorUnitario: item.valorUnitario,
              valorTotal: item.valorTotal
            }))
          }
        },

        include: {
          itens: true
        }
      });

      return res.status(201).json({
        mensagem: "Comprovante analisado e gasto salvo com sucesso.",
        gasto
      });

    } catch (error) {
      if (error instanceof IAIndisponivel) {
        return res.status(503).json({
          mensagem: error.message
        });
      }

      console.error(
        "ERRO AO ANALISAR E SALVAR:",
        error
      );

      return res.status(500).json({
        mensagem: "Erro ao analisar e salvar comprovante.",
        detalhe:
          error instanceof Error
            ? error.message
            : String(error)
      });
    }
  }
);

export default router;