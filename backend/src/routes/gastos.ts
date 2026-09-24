import path from "path";
import { Response, Router } from "express";

import { prisma } from "../config/prisma";
import { upload } from "../config/upload";
import { analisarComprovante } from "../services/analisarComprovante";

import {
  autenticar,
  AuthRequest
} from "../middlewares/autenticacao";

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

    const gasto = await prisma.gasto.create({
      data: {
        estabelecimento,
        total,
        categoria,
        dataCompra: dataCompra ? new Date(dataCompra) : null,
        imagemUrl,
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
  upload.single("comprovante"),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          mensagem: "Nenhuma imagem foi enviada."
        });
      }

      const imagemUrl = `/uploads/${req.file.filename}`;

      return res.status(201).json({
        mensagem: "Comprovante enviado com sucesso.",
        imagemUrl,
        arquivo: req.file.filename
      });

    } catch (error) {
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
      const { imagemUrl } = req.body;

      if (!imagemUrl) {
        return res.status(400).json({
          mensagem: "imagemUrl é obrigatória."
        });
      }

      const caminhoRelativo = imagemUrl.startsWith("/")
        ? imagemUrl.slice(1)
        : imagemUrl;

      const caminhoArquivo = path.resolve(caminhoRelativo);

      const dadosExtraidos =
        await analisarComprovante(caminhoArquivo);

      return res.status(200).json({
        mensagem: "Comprovante analisado com sucesso.",
        dados: dadosExtraidos
      });

    } catch (error) {
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
      const { imagemUrl } = req.body;

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

      if (!imagemUrl.startsWith("/uploads/")) {
        return res.status(400).json({
          mensagem: "Imagem inválida."
        });
      }

      const caminhoRelativo = imagemUrl.slice(1);
      const caminhoArquivo = path.resolve(caminhoRelativo);

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