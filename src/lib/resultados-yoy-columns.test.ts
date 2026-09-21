import { test } from "node:test";
import assert from "node:assert/strict";
import { resultadosYoyCells } from "./resultados-yoy-columns.ts";

test("Resultados YoY lê Meta e Real 2026 antes de percentual e gap", () => {
  const row = Array.from({ length: 20 }, (_, index) => index);
  const cells = resultadosYoyCells(row);

  assert.equal(cells.meta, 4);
  assert.equal(cells.real, 5);
  assert.equal(cells.attainment, 6);
  assert.equal(cells.gap, 7);
});
