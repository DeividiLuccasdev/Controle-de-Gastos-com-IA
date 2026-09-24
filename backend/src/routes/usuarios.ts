import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../config/prisma";

const router = Router();

router.post("/", async (req, res) => {
  try {
    const { nome, email, senha } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({
        mensagem: "Nome, e-mail e senha são obrigatórios."
      });
    }

    const usuarioExistente = await prisma.usuario.findUnique({
      where: {
        email
      }
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
    console.error(error);

    return res.status(500).json({
      mensagem: "Erro interno ao cadastrar usuário."
    });
  }
});

export default router;