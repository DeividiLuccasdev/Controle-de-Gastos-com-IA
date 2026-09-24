import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

export interface AuthRequest extends Request {
  usuarioId?: number;
}

export function autenticar(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return res.status(401).json({
      mensagem: "Token não informado."
    });
  }

  const [tipo, token] = authorization.split(" ");

  if (tipo !== "Bearer" || !token) {
    return res.status(401).json({
      mensagem: "Token inválido."
    });
  }

  const jwtSecret = process.env.JWT_SECRET;

  if (!jwtSecret) {
    return res.status(500).json({
      mensagem: "JWT_SECRET não configurado."
    });
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as JwtPayload & {
      usuarioId?: number;
    };

    if (!decoded.usuarioId) {
      return res.status(401).json({
        mensagem: "Token inválido."
      });
    }

    req.usuarioId = decoded.usuarioId;

    next();
  } catch {
    return res.status(401).json({
      mensagem: "Token inválido ou expirado."
    });
  }
}