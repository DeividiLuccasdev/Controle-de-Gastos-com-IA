import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma";
import { codigoPrisma, responderErro } from "../utils/erros";

const router = Router();

export function normalizarEmail(email: unknown): string {
  return String(email).trim().toLowerCase();
}

router.post("/", async (req, res) => {
  try {
    const { nome, senha } = req.body ?? {};

    if (!nome || !req.body?.email || !senha) {
      return res.status(400).json({
        mensagem: "Nome, e-mail e senha são obrigatórios."
      });
    }

    if (String(senha).length < 6) {
      return res.status(400).json({
        mensagem: "A senha deve ter pelo menos 6 caracteres."
      });
    }

    const email = normalizarEmail(req.body.email);

    // Verificação rápida para a resposta amigável (inclui contas antigas
    // gravadas com maiúsculas). Ela não protege contra cadastros simultâneos:
    // quem garante isso é o índice único do banco, tratado no catch (P2002).
    const usuarioExistente = await prisma.usuario.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true }
    });

    if (usuarioExistente) {
      return res.status(409).json({
        mensagem: "Este e-mail já está cadastrado."
      });
    }

    const senhaHash = await bcrypt.hash(senha, 10);

    const usuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        senha: senhaHash
      },
      select: {
        id: true,
        nome: true,
        email: true,
        criadoEm: true
      }
    });

    return res.status(201).json({
      mensagem: "Usuário cadastrado com sucesso.",
      usuario
    });

  } catch (error) {
    if (codigoPrisma(error) === "P2002") {
      return res.status(409).json({
        mensagem: "Este e-mail já está cadastrado."
      });
    }

    return responderErro(res, error, "ERRO AO CADASTRAR USUÁRIO", "Erro interno ao cadastrar usuário.");
  }
});

export default router;
