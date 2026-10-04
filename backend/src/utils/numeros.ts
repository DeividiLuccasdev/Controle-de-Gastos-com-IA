// Converte valores vindos da IA em número, aceitando os formatos
// brasileiro ("1.234,56") e internacional ("1,234.56" ou "45.90").
export function normalizarNumero(valor: unknown): number {
  if (typeof valor === "number") {
    return Number.isFinite(valor) ? valor : 0;
  }

  if (typeof valor !== "string") {
    return 0;
  }

  // Remove símbolos como "R$" e espaços
  let texto = valor.replace(/[^\d.,-]/g, "");

  const ultimaVirgula = texto.lastIndexOf(",");
  const ultimoPonto = texto.lastIndexOf(".");

  if (ultimaVirgula > ultimoPonto) {
    // Vírgula decimal: "45,90" ou "1.234,56"
    texto = texto.replace(/\./g, "").replace(",", ".");
  } else if (ultimaVirgula !== -1) {
    // Ponto decimal com vírgula de milhar: "1,234.56"
    texto = texto.replace(/,/g, "");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(texto)) {
    // Apenas pontos separando milhares: "1.234" ou "1.234.567"
    texto = texto.replace(/\./g, "");
  }

  const numero = Number(texto);

  return Number.isFinite(numero) ? numero : 0;
}

// Quantidade de itens: inteiro positivo (a coluna do banco é Int)
export function normalizarQuantidade(valor: unknown): number {
  const numero = Math.round(normalizarNumero(valor));

  return numero > 0 ? numero : 1;
}

// Data no formato YYYY-MM-DD; qualquer outro valor vira null
export function normalizarData(valor: unknown): string | null {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return null;
  }

  return Number.isNaN(Date.parse(valor)) ? null : valor;
}
