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
  baseURL: "https://api.groq.com/openai/v1"
});

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

function limparJson(texto: string): string {
  return texto
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
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

  const resposta = await ai.responses.create({
    model: "qwen/qwen3.8-27b",
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