import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import multer from "multer";
import sharp from "sharp";

export const UPLOADS_DIR = path.resolve("uploads");

const TIPOS_PERMITIDOS = [
  "image/jpeg",
  "image/png",
  "image/webp"
];

// O arquivo fica em memória até ser validado e convertido pelo Sharp:
// só imagens de verdade chegam ao disco.
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    if (!TIPOS_PERMITIDOS.includes(file.mimetype)) {
      return cb(new Error("Formato de imagem não permitido. Use JPEG, PNG ou WEBP."));
    }

    cb(null, true);
  }
});

export class ImagemInvalidaError extends Error {}

// Converte a imagem para JPEG (removendo metadados como a localização GPS)
// e salva na pasta do usuário. Retorna o imagemUrl usado pela API.
export async function salvarImagem(
  conteudo: Buffer,
  usuarioId: number
): Promise<string> {
  let jpeg: Buffer;

  try {
    jpeg = await sharp(conteudo)
      .rotate()
      .jpeg({ quality: 90 })
      .toBuffer();
  } catch {
    throw new ImagemInvalidaError("O arquivo enviado não é uma imagem válida.");
  }

  const pasta = path.join(UPLOADS_DIR, String(usuarioId));
  const nomeArquivo = `${crypto.randomUUID()}.jpg`;

  await fs.mkdir(pasta, { recursive: true });
  await fs.writeFile(path.join(pasta, nomeArquivo), jpeg);

  return `/uploads/${usuarioId}/${nomeArquivo}`;
}

const FORMATO_IMAGEM_URL =
  /^\/uploads\/(\d+)\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jpg$/;

// Converte um imagemUrl no caminho do arquivo, aceitando apenas imagens
// do próprio usuário. Retorna null para qualquer outro valor
// (inclusive tentativas como "/uploads/../.env").
export function resolverImagem(
  imagemUrl: unknown,
  usuarioId: number
): string | null {
  if (typeof imagemUrl !== "string") {
    return null;
  }

  const partes = FORMATO_IMAGEM_URL.exec(imagemUrl);

  if (!partes || Number(partes[1]) !== usuarioId) {
    return null;
  }

  return path.join(UPLOADS_DIR, partes[1], `${partes[2]}.jpg`);
}
