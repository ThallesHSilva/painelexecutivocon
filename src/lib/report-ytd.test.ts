import { test } from "node:test";
import assert from "node:assert/strict";
import { buildYtdSummary } from "./report-ytd.ts";

const conforme = {
  product: "Móvel Líquido",
  meta: 1000,
  real: 800,
  previousReal: 500,
  attainment: 0.8,
  gap: -200,
  average: 133.33,
  yoy: 0.6,
  yoyGap: 300,
};

test("registro único preserva exatamente os campos importados", () => {
  const summary = buildYtdSummary("Móvel Líquido", [conforme]);
  assert.equal(summary.meta, 1000);
  assert.equal(summary.real, 800);
  assert.equal(summary.attainment, 0.8);
  assert.equal(summary.gap, -200);
  assert.equal(summary.average, 133.33);
  assert.equal(summary.yoyGap, 300);
  assert.equal(summary.yoy, 0.6);
});

test("vários registros somam e recalculam atingimento e YoY", () => {
  const summary = buildYtdSummary("Móvel Líquido", [
    { ...conforme, meta: 600, real: 300, previousReal: 200, gap: -300, yoyGap: 100 },
    { ...conforme, meta: 400, real: 500, previousReal: 300, gap: 100, yoyGap: 200 },
  ]);
  assert.equal(summary.meta, 1000);
  assert.equal(summary.real, 800);
  assert.equal(summary.previousReal, 500);
  assert.equal(summary.attainment, 0.8);
  assert.equal(summary.yoy, 800 / 500 - 1);
  assert.equal(summary.gap, -200);
  assert.equal(summary.yoyGap, 300);
});

test("NAN_LEGADO: snapshot sem derivados não produz valor não finito", () => {
  const legado = { product: "Móvel Líquido", meta: 1000, real: 800, previousReal: 500 };
  const summary = buildYtdSummary("Móvel Líquido", [legado]);

  for (const value of [summary.meta, summary.real, summary.previousReal]) {
    assert.equal(Number.isFinite(value), true);
  }
  // Derivado ausente é indisponibilidade explícita, nunca zero nem NaN.
  assert.equal(summary.attainment, null);
  assert.equal(summary.gap, null);
  assert.equal(summary.average, null);
  assert.equal(summary.yoyGap, null);
  assert.equal(summary.yoy, null);
});

test("NAN_LEGADO agregado: derivados ausentes somem sem contaminar a soma", () => {
  const summary = buildYtdSummary("Móvel Líquido", [
    { product: "Móvel Líquido", meta: 600, real: 300, previousReal: 200 },
    { ...conforme, meta: 400, real: 500, previousReal: 300, gap: 100, yoyGap: 200 },
  ]);
  assert.equal(summary.attainment, 0.8);
  assert.equal(summary.yoy, 800 / 500 - 1);
  assert.equal(summary.gap, 100);
  assert.equal(summary.yoyGap, 200);
  assert.equal(Number.isNaN(summary.gap), false);
});

test("valor não finito no snapshot é tratado como ausência", () => {
  const summary = buildYtdSummary("Móvel Líquido", [
    { ...conforme, attainment: Number.NaN, yoy: Number.POSITIVE_INFINITY },
  ]);
  assert.equal(summary.attainment, null);
  assert.equal(summary.yoy, null);
});

test("ZERO_REAL: zero permanece zero e não vira indisponibilidade", () => {
  const summary = buildYtdSummary("Móvel Líquido", [
    { ...conforme, real: 0, attainment: 0, gap: 0, average: 0, yoy: 0, yoyGap: 0 },
  ]);
  assert.equal(summary.real, 0);
  assert.equal(summary.attainment, 0);
  assert.equal(summary.gap, 0);
  assert.equal(summary.yoy, 0);
});

test("meta zero com registros mantém atingimento zero, como na visão Resultados", () => {
  const summary = buildYtdSummary("Móvel Líquido", [
    { product: "Móvel Líquido", meta: 0, real: 0, previousReal: 0 },
    { product: "Móvel Líquido", meta: 0, real: 0, previousReal: 0 },
  ]);
  assert.equal(summary.attainment, 0);
  assert.equal(summary.yoy, 0);
});

test("produto sem registros na torre não inventa resultado", () => {
  const summary = buildYtdSummary("Vivo Tech", [conforme]);
  assert.equal(summary.attainment, null);
  assert.equal(summary.yoy, null);
  assert.equal(summary.meta, 0);
});

test("casamento de produto ignora acentos e pontuação", () => {
  const summary = buildYtdSummary("Movel Liquido", [conforme]);
  assert.equal(summary.real, 800);
});
