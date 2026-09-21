import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAuthorizedResultsPayload } from "./results-access.ts";
import type {
  BestGuessRecord,
  PortabilidadeSnapshot,
  ResultadosYoySnapshot,
  TorresServicoSnapshot,
} from "./snapshot-types.ts";

const partners = [
  { id: "pv-alpha", name: "Álpha Telecom" },
  { id: "pv-beta", name: "Beta Business" },
];

const resultRecord = (company: string): ResultadosYoySnapshot["records"][number] => ({
  company,
  product: "Móvel Líquido",
  meta: 100,
  real: 80,
  attainment: 0.8,
  gap: -20,
  average: 10,
  previousMeta: 90,
  previousReal: 70,
  previousAttainment: 70 / 90,
  previousGap: -20,
  previousAverage: 8.75,
  yoy: 80 / 70 - 1,
  yoyGap: 10,
});

const bestGuessRecord = (company: string, value: number): BestGuessRecord => ({
  company,
  division: "Varejo",
  m0MtdPortIn: value,
  m0MtdPortOut: value,
  m0MtdSaldo: value,
  bgFmPortIn: value,
  bgFmPortOut: value,
  bgFmSaldo: value,
});

const mapa = { partners };

const resultados = {
  source: {
    report: "fixture",
    companyColumn: "company",
    period: "2026",
    monthsElapsed: 8,
    previousPeriod: "2025",
    importedAt: "2026-09-20T00:00:00.000Z",
  },
  records: [resultRecord("ALPHA TELECOM"), resultRecord("Beta-Business")],
} satisfies ResultadosYoySnapshot;

const bestGuess = {
  source: { report: "fixture" },
  records: [bestGuessRecord("Álpha Telecom", 10), bestGuessRecord("Beta Business", 20)],
  total: {
    m0MtdPortIn: 30,
    m0MtdPortOut: 30,
    m0MtdSaldo: 30,
    bgFmPortIn: 30,
    bgFmPortOut: 30,
    bgFmSaldo: 30,
  },
};

const portabilidade = {
  source: { report: "fixture" },
  records: [
    { company: "Alpha Telecom", month: 8, operator: "A", portIn: 10, portOut: 2 },
    { company: "Beta Business", month: 8, operator: "B", portIn: 20, portOut: 4 },
  ],
} satisfies PortabilidadeSnapshot;

const torres = {
  source: { report: "fixture" },
  towers: [
    {
      id: "fixture",
      title: "Fixture",
      sourceTitle: "Fixture",
      columns: [
        { key: "forecast", label: "Forecast", format: "number" },
        { key: "bgxpc", label: "BG x PC", format: "percent" },
      ],
      rows: [
        { partner: "Alpha", values: { forecast: 10, bgxpc: 0.75 } },
        { partner: "Beta", values: { forecast: 20, bgxpc: 0.9 } },
      ],
      total: { forecast: 999, bgxpc: 9.99 },
    },
  ],
} satisfies TorresServicoSnapshot;

const snapshots = { mapa, resultados, bestGuess, portabilidade, torres };

test("helper mantém o bloqueio de administrador da rota", () => {
  assert.throws(
    () => buildAuthorizedResultsPayload({ role: "admin", partnerIds: [] }, snapshots),
    /Administradores não podem acessar dados de resultados/,
  );
});

test("Diretor preserva todas as linhas e o total global importado das Torres", () => {
  const payload = buildAuthorizedResultsPayload({ role: "director", partnerIds: [] }, snapshots);

  assert.equal(payload.resultados.records.length, 2);
  assert.equal(payload.bestGuess.records.length, 2);
  assert.equal(payload.portabilidade.records.length, 2);
  assert.deepEqual(
    payload.torres.towers[0]?.rows.map((row) => row.partner),
    ["Álpha Telecom", "Beta Business"],
  );
  assert.deepEqual(payload.torres.towers[0]?.total, torres.towers[0]?.total);
});

test("GN com vínculo recebe somente o parceiro autorizado em todos os datasets", () => {
  const payload = buildAuthorizedResultsPayload(
    { role: "gn", partnerIds: ["pv-alpha"] },
    snapshots,
  );

  assert.deepEqual(
    payload.resultados.records.map((record) => record.company),
    ["ALPHA TELECOM"],
  );
  assert.deepEqual(
    payload.bestGuess.records.map((record) => record.company),
    ["Álpha Telecom"],
  );
  assert.deepEqual(
    payload.portabilidade.records.map((record) => record.company),
    ["Alpha Telecom"],
  );
  assert.deepEqual(payload.torres.towers[0]?.rows, [
    { partner: "Álpha Telecom", values: { forecast: 10, bgxpc: 0.75 } },
  ]);
  assert.deepEqual(payload.torres.towers[0]?.total, { forecast: 10, bgxpc: 0.75 });
  assert.equal(payload.bestGuess.total.bgFmSaldo, 10);
  assert.equal(JSON.stringify(payload).includes("Beta"), false);
});

test("GN sem vínculo não recebe linhas nem total global de Torres", () => {
  const payload = buildAuthorizedResultsPayload({ role: "gn", partnerIds: [] }, snapshots);

  assert.equal(payload.resultados.records.length, 0);
  assert.equal(payload.bestGuess.records.length, 0);
  assert.equal(payload.portabilidade.records.length, 0);
  assert.deepEqual(payload.torres.towers[0]?.rows, []);
  assert.deepEqual(payload.torres.towers[0]?.total, {});
  assert.equal(payload.bestGuess.total.bgFmSaldo, 0);
  assert.equal(JSON.stringify(payload).includes("Alpha"), false);
  assert.equal(JSON.stringify(payload).includes("Beta"), false);
});
