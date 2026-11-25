import test from "node:test";
import assert from "node:assert/strict";
import { towerImageColumns, towerRanking, towerRankingColumns } from "./tower-ranking-image.ts";
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

test("Dados Avançados ordena por x PC em vez de volume ou ordem da base", () => {
  const data: ServiceTower = {
    ...tower,
    id: "dados-avancados",
    columns: [
      { key: "v", label: "Ativado", format: "number" },
      { key: "p", label: "x PC", format: "percent" },
    ],
    rows: [
      { partner: "A7", values: { v: 1616, p: 0.349 } },
      { partner: "OCIDENTAL", values: { v: 390, p: 0.73 } },
      { partner: "LIVE", values: { v: 1545, p: 0.62 } },
      { partner: "PROVISAO", values: { v: 707, p: 1.986 } },
      { partner: "Zero", values: { v: 0, p: 0 } },
      { partner: "Ausente", values: { v: null, p: null } },
    ],
    total: { v: 8267, p: 0.434 },
  };
  assert.deepEqual(
    towerRanking(data).map((r) => r.partner),
    ["PROVISAO", "OCIDENTAL", "LIVE", "A7", "Zero", "Ausente"],
  );
  assert.equal(towerRankingColumns(data)[0].label, "x PC");
  assert.equal(towerImageColumns(data).ratio?.key, "p");
  assert.equal(data.total.p, 0.434);
  assert.equal(data.rows[0].partner, "A7");
});

test("todas as torres usam PC antes de Meta e a imagem usa a mesma coluna", () => {
  const ids = [
    "altas-movel",
    "aparelhos",
    "banda-larga",
    "dados-avancados",
    "vvn",
    "voz",
    "ti-recorrente",
    "vivo-tech",
  ];
  for (const id of ids)
    for (const label of ["BG x PC", "x PC", "Est x PC", "PC"]) {
      const data: ServiceTower = {
        ...tower,
        id,
        columns: [
          { key: "m", label: "Meta", format: "percent" },
          { key: "p", label, format: "percent" },
        ],
        rows: [
          { partner: "Volume maior", values: { p: 0.5, m: 9 } },
          { partner: "Beta", values: { p: 1.2, m: 8 } },
          { partner: "Alfa", values: { p: 1.2, m: 1 } },
        ],
      };
      assert.deepEqual(
        towerRanking(data).map((r) => r.partner),
        ["Alfa", "Beta", "Volume maior"],
        id + label,
      );
      assert.equal(towerImageColumns(data).ratio?.key, "p");
    }
});
