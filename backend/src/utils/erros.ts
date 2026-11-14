import { Response } from "express";

import { ImagemInvalidaError } from "../config/upload";
import {
  IAIndisponivel,
  IARespostaInvalida,
  IATempoEsgotado
} from "../services/analisarComprovante";

type RespostaDeErro = { status: number; mensagem: string };

export function codigoPrisma(erro: unknown): string | undefined {
  const codigo = (erro as { code?: unknown } | null)?.code;

  return typeof codigo === "string" && /^P\d{4}$/.test(codigo)
    ? codigo
    : undefined;
}

// Converte um erro em status HTTP + mensagem segura para o usuário.
// Detalhes internos (mensagem do banco, stack, resposta da IA) ficam só no log.
export function traduzirErro(
  erro: unknown,
  mensagemPadrao: string
): RespostaDeErro {
  if (erro instanceof ImagemInvalidaError) {
    return { status: 400, mensagem: erro.message };
  }

  if ((erro as NodeJS.ErrnoException | null)?.code === "ENOENT") {
    return { status: 400, mensagem: "Imagem inválida." };
  }

  if (erro instanceof IAIndisponivel) {
    return { status: 503, mensagem: erro.message };
  }

  if (erro instanceof IATempoEsgotado) {
    return { status: 504, mensagem: erro.message };
  }

  if (erro instanceof IARespostaInvalida) {
    return { status: 502, mensagem: "Não foi possível ler o comprovante. Tente outra foto." };
  }

  switch (codigoPrisma(erro)) {
    case "P2002":
      return { status: 409, mensagem: "Registro duplicado." };
    case "P2025":
      return { status: 404, mensagem: "Registro não encontrado." };
    case "P2003":
      return { status: 400, mensagem: "Referência inválida." };
  }

  return { status: 500, mensagem: mensagemPadrao };
}

export function responderErro(
  res: Response,
  erro: unknown,
  contexto: string,
  mensagemPadrao: string
) {
  const { status, mensagem } = traduzirErro(erro, mensagemPadrao);

  if (status >= 500) {
    console.error(`${contexto}:`, erro);
  }

  return res.status(status).json({ mensagem });
}
