import multer from "multer";
import path from "path";
import crypto from "crypto";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },

  filename: (req, file, cb) => {
    const extensao = path.extname(file.originalname);
    const nomeArquivo = `${crypto.randomUUID()}${extensao}`;

    cb(null, nomeArquivo);
  }
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const tiposPermitidos = [
      "image/jpeg",
      "image/png",
      "image/webp"
    ];

    if (!tiposPermitidos.includes(file.mimetype)) {
      return cb(new Error("Formato de imagem não permitido."));
    }

    cb(null, true);
  }
});