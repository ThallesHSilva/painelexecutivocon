import { test } from "node:test";
import assert from "node:assert/strict";
import { resultadosYoyCells, resultadosYoyColumns } from "./resultados-yoy-columns.ts";

test("Resultados YoY detecta o bloco atual no layout com colunas G/H", () => {
  const header = [
    "",
    null,
    "NOME_REDE",
    "NM_GN",
    "",
    "",
    "Meta",
    "Real",
    "%",
    "Gap TT",
    "",
    "",
    "",
    "Meta",
    "Real",
    "%",
    "Gap TT",
    "",
    "",
    "",
    "%",
    "Gap TT",
  ];
  const row = Array.from({ length: 20 }, (_, index) => index);
  const columns = resultadosYoyColumns(header);
  const cells = resultadosYoyCells(row, columns);

  assert.equal(columns.meta, 6);
  assert.equal(columns.real, 7);
  assert.equal(cells.meta, 6);
  assert.equal(cells.real, 7);
  assert.equal(cells.attainment, 8);
  assert.equal(cells.gap, 9);
});

test("Resultados YoY preserva o layout legado com colunas E/F", () => {
  const header = [
    "",
    null,
    "NOME_REDE",
    "",
    "Meta",
    "Real",
    "%",
    "Gap TT",
    "",
    "",
    "",
    "Meta",
    "Real",
    "%",
    "Gap TT",
    "",
    "",
    "",
    "%",
    "Gap TT",
  ];
  const columns = resultadosYoyColumns(header);

  assert.equal(columns.meta, 4);
  assert.equal(columns.real, 5);
});

test("Resultados YoY aceita cabeçalhos com o ano no nome das colunas", () => {
  const header = [
    "Produto",
    "NOME_REDE",
    "Meta 2026",
    "Real 2026",
    "%",
    "Gap TT",
    "Meta 2025",
    "Real 2025",
  ];
  const row = ["MÓVEL LIQUIDO_PV", "A7 CONNECT", 10, 8, 0.8, -2, 9, 7];
  const columns = resultadosYoyColumns(header);
  const cells = resultadosYoyCells(row, columns);

  assert.equal(columns.meta, 2);
  assert.equal(columns.real, 3);
  assert.equal(cells.meta, 10);
  assert.equal(cells.real, 8);
});
