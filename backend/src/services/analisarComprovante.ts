import { GoogleGenAI } from "@google/genai";
import fs from "fs/promises";
import sharp from "sharp";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
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

function normalizarNumero(valor: unknown): number {
  if (typeof valor === "number") {
    return valor;
  }

  if (typeof valor === "string") {
    const convertido = Number(
      valor
        .replace(/\./g, "")
        .replace(",", ".")
        .trim()
    );

    return Number.isNaN(convertido) ? 0 : convertido;
  }

  return 0;
}

export async function analisarComprovante(
  caminhoArquivo: string
): Promise<ResultadoComprovante> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY não configurada.");
  }

  const arquivoOriginal = await fs.readFile(caminhoArquivo);

  // Converte AVIF, PNG, WEBP etc. para JPEG padrão
  const jpegBuffer = await sharp(arquivoOriginal)
    .rotate()
    .jpeg({
      quality: 90
    })
    .toBuffer();

  const base64 = jpegBuffer.toString("base64");

  const resposta = await ai.interactions.create({
    model: "gemini-3.8-flash",
    input: [
      {
        type: "text",
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
        type: "image",
        data: base64,
        mime_type: "image/jpeg"
      }
    ]
  });

  const texto = limparJson(resposta.output_text ?? "");

  if (!texto) {
    throw new Error("A IA não retornou dados do comprovante.");
  }

  const bruto = JSON.parse(texto) as Partial<ResultadoComprovante>;

  const resultado: ResultadoComprovante = {
    estabelecimento: bruto.estabelecimento ?? null,
    dataCompra: bruto.dataCompra ?? null,
    total:
      bruto.total === null || bruto.total === undefined
        ? null
        : normalizarNumero(bruto.total),
    categoria: bruto.categoria ?? null,
    itens: Array.isArray(bruto.itens)
      ? bruto.itens.map((item: any) => ({
          produto: String(item?.produto ?? ""),
          quantidade: Number(item?.quantidade ?? 0),
          valorUnitario: normalizarNumero(item?.valorUnitario),
          valorTotal: normalizarNumero(item?.valorTotal)
        }))
      : []
  };

  return resultado;
}