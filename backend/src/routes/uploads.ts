import { Response, Router } from "express";

import { resolverImagem } from "../config/upload";
import {
  autenticar,
  AuthRequest
} from "../middlewares/autenticacao";

const router = Router();

// Comprovantes contêm dados financeiros: cada usuário só acessa os seus.
router.get(
  "/:usuarioId/:arquivo",
  autenticar,
  (req: AuthRequest, res: Response) => {
    const imagemUrl =
      `/uploads/${req.params.usuarioId}/${req.params.arquivo}`;

    const caminho = req.usuarioId
      ? resolverImagem(imagemUrl, req.usuarioId)
      : null;

    if (!caminho) {
      return res.status(404).json({
        mensagem: "Imagem não encontrada."
      });
    }

    return res.sendFile(caminho, (erro) => {
      if (erro && !res.headersSent) {
        res.status(404).json({
          mensagem: "Imagem não encontrada."
        });
      }
    });
  }
);

export default router;
