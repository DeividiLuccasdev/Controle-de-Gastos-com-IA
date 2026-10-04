import assert from "node:assert/strict";
import { test } from "node:test";

import {
  normalizarData,
  normalizarNumero,
  normalizarQuantidade
} from "./numeros";

test("normalizarNumero aceita formato brasileiro e internacional", () => {
  assert.equal(normalizarNumero(45.9), 45.9);
  assert.equal(normalizarNumero("45,90"), 45.9);
  assert.equal(normalizarNumero("1.234,56"), 1234.56);
  assert.equal(normalizarNumero("45.90"), 45.9);
  assert.equal(normalizarNumero("12.5"), 12.5);
  assert.equal(normalizarNumero("1,234.56"), 1234.56);
  assert.equal(normalizarNumero("1.234"), 1234);
  assert.equal(normalizarNumero("R$ 1.234,56"), 1234.56);
});

test("normalizarNumero devolve 0 para valores inválidos", () => {
  assert.equal(normalizarNumero("abc"), 0);
  assert.equal(normalizarNumero(null), 0);
  assert.equal(normalizarNumero(Number.NaN), 0);
});

test("normalizarQuantidade devolve inteiro positivo", () => {
  assert.equal(normalizarQuantidade(3), 3);
  assert.equal(normalizarQuantidade("2"), 2);
  assert.equal(normalizarQuantidade(1.6), 2);
  assert.equal(normalizarQuantidade(0), 1);
  assert.equal(normalizarQuantidade(undefined), 1);
});

test("normalizarData aceita apenas YYYY-MM-DD válido", () => {
  assert.equal(normalizarData("2026-10-04"), "2026-10-04");
  assert.equal(normalizarData("04/10/2026"), null);
  assert.equal(normalizarData("2026-13-45"), null);
  assert.equal(normalizarData(null), null);
});
