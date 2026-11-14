import fs from "fs/promises";
import path from "path";

import { prisma } from "../config/prisma";
import { removerArquivo, resolverImagem, UPLOADS_DIR } from "../config/upload";

// Remove a imagem do disco se nenhum gasto do usuário a referencia.
// Usado nos caminhos de falha (IA falhou, total não identificado, erro no
// banco, análise cancelada) para não deixar comprovantes órfãos.
export async function descartarImagemSeOrfa(
  imagemUrl: unknown,
  usuarioId: number
): Promise<void> {
  const caminho = resolverImagem(imagemUrl, usuarioId);

  if (!caminho) {
    return;
  }

  try {
    const emUso = await prisma.gasto.findFirst({
      where: { usuarioId, imagemUrl: imagemUrl as string },
      select: { id: true }
    });

    if (!emUso) {
      await removerArquivo(caminho);
    }
  } catch (erro) {
    // Na dúvida, mantém o arquivo: a limpeza periódica cuida dele depois.
    console.error("Não foi possível verificar a imagem para descarte:", erro);
  }
}

const UMA_HORA = 60 * 60 * 1000;

// Apaga arquivos que nenhum gasto referencia e que já passaram do prazo
// (o usuário pode estar conferindo a análise antes de salvar, por isso
// só arquivos antigos entram). Também apaga .tmp abandonados.
export async function limparUploadsOrfaos(
  idadeMinimaMs = 24 * UMA_HORA,
  agora = Date.now()
): Promise<number> {
  let removidos = 0;
  let pastas: string[];

  try {
    pastas = await fs.readdir(UPLOADS_DIR);
  } catch {
    return 0;
  }

  for (const pasta of pastas) {
    if (!/^\d+$/.test(pasta)) continue;

    const usuarioId = Number(pasta);
    const dir = path.join(UPLOADS_DIR, pasta);
    let arquivos: string[];

    try {
      arquivos = await fs.readdir(dir);
    } catch {
      continue;
    }

    const candidatos: string[] = [];

    for (const arquivo of arquivos) {
      const caminho = path.join(dir, arquivo);
      const info = await fs.stat(caminho).catch(() => null);

      if (!info?.isFile()) continue;

      const idade = agora - info.mtimeMs;

      if (arquivo.endsWith(".tmp")) {
        if (idade > UMA_HORA) {
          await removerArquivo(caminho);
          removidos++;
        }
        continue;
      }

      if (idade > idadeMinimaMs) {
        candidatos.push(`/uploads/${pasta}/${arquivo}`);
      }
    }

    if (candidatos.length === 0) continue;

    const referenciados = await prisma.gasto.findMany({
      where: { usuarioId, imagemUrl: { in: candidatos } },
      select: { imagemUrl: true }
    });
    const emUso = new Set(referenciados.map((g) => g.imagemUrl));

    for (const imagemUrl of candidatos) {
      if (emUso.has(imagemUrl)) continue;

      const caminho = resolverImagem(imagemUrl, usuarioId);

      if (caminho) {
        await removerArquivo(caminho);
        removidos++;
      }
    }
  }

  return removidos;
}

// Executa a limpeza ao iniciar e depois a cada intervalo.
export function agendarLimpezaDeUploads(intervaloMs = 6 * UMA_HORA) {
  const executar = () =>
    limparUploadsOrfaos()
      .then((n) => {
        if (n > 0) console.log(`Limpeza de uploads: ${n} arquivo(s) órfão(s) removido(s).`);
      })
      .catch((erro) => console.error("Falha na limpeza de uploads:", erro));

  void executar();
  setInterval(executar, intervaloMs).unref();
}
