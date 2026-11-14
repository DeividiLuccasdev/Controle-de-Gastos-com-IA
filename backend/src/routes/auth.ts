import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "../config/prisma";
import { responderErro } from "../utils/erros";
import { normalizarEmail } from "./usuarios";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const { email, senha } = req.body ?? {};

    if (!email || !senha) {
      return res.status(400).json({
        mensagem: "E-mail e senha são obrigatórios."
      });
    }

    // Sem diferenciar maiúsculas: contas antigas podem ter sido
    // gravadas antes da normalização do e-mail.
    const usuario = await prisma.usuario.findFirst({
      where: {
        email: { equals: normalizarEmail(email), mode: "insensitive" }
      },
      orderBy: { id: "asc" }
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
    return responderErro(res, error, "ERRO NO LOGIN", "Erro interno ao realizar login.");
  }
});

export default router;