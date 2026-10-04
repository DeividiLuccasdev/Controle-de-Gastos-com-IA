import OpenAI from "openai";
import fs from "fs/promises";
import sharp from "sharp";

import {
  normalizarData,
  normalizarNumero,
  normalizarQuantidade
} from "../utils/numeros";

const ai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1"
});

// Modelo com suporte a imagens no Groq (pode ser trocado sem mexer no código)
const MODELO_IA = process.env.GROQ_MODEL || "qwen/qwen3.8-27b";

// Erro do provedor de IA que não é falha do sistema (sem crédito,
// limite de uso atingido ou chave inválida): vira uma mensagem amigável.
export class IAIndisponivel extends Error {}

type ItemExtraido = {
  produto: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
};

type ResultadoComprovante = {
  estabelecimento: string | null;
  dataCompra: string | null;
  total: number | null;
  categoria: string | null;
  itens: ItemExtraido[];
};

// Extrai o objeto JSON da resposta, mesmo que a IA escreva algo
// antes ou depois dele (ou o coloque num bloco ```json).
function limparJson(texto: string): string {
  const inicio = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");

  if (inicio === -1 || fim < inicio) {
    return "";
  }

  return texto.slice(inicio, fim + 1);
}

export async function analisarComprovante(
  caminhoArquivo: string
): Promise<ResultadoComprovante> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY não configurada.");
  }

  const arquivoOriginal = await fs.readFile(caminhoArquivo);

  const jpegBuffer = await sharp(arquivoOriginal)
    .rotate()
    .jpeg({
      quality: 90
    })
    .toBuffer();

  const base64 = jpegBuffer.toString("base64");

  let resposta;

  try {
    resposta = await ai.responses.create({
      model: MODELO_IA,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `
  Analise esta imagem de um comprovante ou nota fiscal.

  Retorne APENAS um JSON válido.
  Não escreva explicações.
  Não utilize markdown.
  Não escreva nenhum texto fora do JSON.

  Formato:

  {
    "estabelecimento": "string ou null",
    "dataCompra": "YYYY-MM-DD ou null",
    "total": 0,
    "categoria": "string ou null",
    "itens": [
      {
        "produto": "string",
        "quantidade": 1,
        "valorUnitario": 0,
        "valorTotal": 0
      }
    ]
  }

  Regras:
  - Se não encontrar algum dado, use null.
  - total deve ser numérico.
  - quantidade deve ser número inteiro.
  - valorUnitario deve ser numérico.
  - valorTotal deve ser numérico.
  - A categoria pode ser inferida.
  - Se não conseguir identificar os produtos com segurança, retorne "itens": [].
  - A dataCompra deve ser retornada no formato YYYY-MM-DD.
  `
            },
            {
              type: "input_image",
              image_url: `data:image/jpeg;base64,${base64}`,
              detail: "auto"
            }
          ]
        }
      ]
    });
  } catch (erro) {
    if (
      erro instanceof OpenAI.APIError &&
      (erro.status === 401 || erro.status === 403 || erro.status === 429)
    ) {
      console.error(
        `Groq recusou a requisição (${erro.status}): ${erro.message}`
      );

      throw new IAIndisponivel(
        "A análise por IA está temporariamente indisponível. Tente novamente em alguns minutos."
      );
    }

    throw erro;
  }

  const texto = limparJson(resposta.output_text ?? "");

  if (!texto) {
    throw new Error("A IA não retornou dados do comprovante.");
  }

  const bruto = JSON.parse(texto) as Partial<ResultadoComprovante>;

  return {
    estabelecimento: bruto.estabelecimento ?? null,
    dataCompra: normalizarData(bruto.dataCompra),
    total:
      bruto.total === null || bruto.total === undefined
        ? null
        : normalizarNumero(bruto.total),
    categoria: bruto.categoria ?? null,
    itens: Array.isArray(bruto.itens)
      ? bruto.itens.map((item: any) => ({
          produto: String(item?.produto ?? ""),
          quantidade: normalizarQuantidade(item?.quantidade),
          valorUnitario: normalizarNumero(item?.valorUnitario),
          valorTotal: normalizarNumero(item?.valorTotal)
        }))
      : []
  };
}