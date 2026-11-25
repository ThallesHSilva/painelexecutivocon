import test from "node:test";
import assert from "node:assert/strict";
import { towerImageColumns, towerRanking } from "./tower-ranking-image.ts";
import type { ServiceTower } from "./snapshot-types.ts";

const tower: ServiceTower = {
  id: "altas-movel",
  title: "Altas Móvel",
  sourceTitle: "Altas Móvel",
  columns: [
    { key: "f", label: "Forecast", format: "number" },
    { key: "b", label: "BG", format: "number" },
    { key: "a", label: "Ativado", format: "number" },
    { key: "p", label: "BG x PC", format: "percent" },
  ],
  rows: [
    { partner: "Sem dado", values: { p: null } },
    { partner: "Zero", values: { p: 0 } },
    { partner: "Beta", values: { p: 1.2 } },
    { partner: "Alfa", values: { p: 1.2 } },
  ],
  total: { b: 300, p: 0.75 },
};
test("imagem usa o indicador comercial correto, não a primeira coluna Forecast", () => {
  assert.equal(towerImageColumns(tower).metric?.key, "b");
  assert.equal(towerImageColumns({ ...tower, id: "banda-larga" }).metric?.key, "b");
  for (const id of ["vvn", "voz", "ti-recorrente", "dados-avancados", "aparelhos"]) {
    assert.equal(towerImageColumns({ ...tower, id }).metric?.key, "a");
  }
  assert.equal(tower.total.p, 0.75);
});
test("ranking compartilhado preserva desempate, zero antes de ausente e não altera a base", () => {
  assert.deepEqual(
    towerRanking(tower).map((r) => r.partner),
    ["Alfa", "Beta", "Zero", "Sem dado"],
  );
  assert.equal(tower.rows[0].partner, "Sem dado");
  assert.equal(towerImageColumns({ ...tower, columns: [] }).metric, undefined);
});
