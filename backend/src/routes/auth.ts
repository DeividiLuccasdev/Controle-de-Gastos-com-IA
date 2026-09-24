import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({
        mensagem: "E-mail e senha são obrigatórios."
      });
    }

    const usuario = await prisma.usuario.findUnique({
      where: {
        email: email
      }
    });

    if (!usuario) {
      return res.status(401).json({
        mensagem: "E-mail ou senha inválidos."
      });
    }

    const senhaValida = await bcrypt.compare(
      senha,
      usuario.senha
    );

    if (!senhaValida) {
      return res.status(401).json({
        mensagem: "E-mail ou senha inválidos."
      });
    }

    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error("JWT_SECRET não configurado.");
    }

    const token = jwt.sign(
      {
        usuarioId: usuario.id,
        email: usuario.email
      },
      jwtSecret,
      {
        expiresIn: "7d"
      }
    );

    return res.status(200).json({
      mensagem: "Login realizado com sucesso.",
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email
      }
    });
  } catch (error) {
    console.error("ERRO NO LOGIN:", error);

    return res.status(500).json({
      mensagem: "Erro interno ao realizar login.",
      detalhe:
        error instanceof Error
          ? error.message
          : String(error)
    });
  }
});

export default router;