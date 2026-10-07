import assert from "node:assert/strict";
import test from "node:test";
import { calculateQscSnapshot } from "./qsc-metrics.mjs";

const metric = (id, numerator, denominator, subIndicator, overrides = {}) => ({
  domain: "carteira",
  indicator: "QSC Carteira",
  subIndicator,
  competence: "2026-09",
  partnerId: "a7connect",
  partnerName: "A7CONNECT",
  movement: id,
  quantity: numerator,
  rows: numerator,
  denominator,
  documentCount: numerator,
  ...overrides,
});

test("reproduz KPI 2 com o numerador nos denominadores de Churn BL e Invasão", () => {
  const movements = [
    metric("CHURN", 203, 0, "% Churn Banda Larga"),
    metric("PARQUE BL", 14_344, 0, "% Churn Banda Larga"),
    metric("CLIENTE INVADIDO", 37, 0, "% Invasao de Carteira"),
    metric("ALTA CARTEIRA", 529, 0, "% Invasao de Carteira"),
  ];
  const snapshot = calculateQscSnapshot({
    movements,
    details: [],
    partners: [{ id: "a7connect", name: "A7CONNECT" }],
    competencies: ["2026-09"],
  });
  const metrics = snapshot.scopes[0].metrics;

  assert.deepEqual(
    metrics
      .filter((item) => ["churn-bl", "invasao-carteira"].includes(item.id))
      .map((item) => [item.id, item.latest.numerator, item.latest.denominator]),
    [
      ["churn-bl", 203, 14_547],
      ["invasao-carteira", 37, 566],
    ],
  );
});

test("mantém KPI 2 de CAR sem somar o numerador", () => {
  const snapshot = calculateQscSnapshot({
    movements: [
      metric("CLIENTE COM CAR ACIMA DE 30 DIAS", 4_672, 0, "% Documentos com CAR"),
      metric("CNPJ", 27_461, 0, "% Documentos com CAR"),
    ],
    details: [],
    partners: [{ id: "a7connect", name: "A7CONNECT" }],
    competencies: ["2026-09"],
  });
  const car = snapshot.scopes[0].metrics.find((item) => item.id === "car");
  assert.deepEqual([car.latest.numerator, car.latest.denominator], [4_672, 27_461]);
});

test("inclui Re-Alta no total de altas do KPI 2", () => {
  const snapshot = calculateQscSnapshot({
    movements: [
      metric("RE-ALTA", 2, 0, "Re-alta", { domain: "fixa", competence: "2026-08" }),
      metric("ALTAS", 169, 0, "Re-alta", { domain: "fixa", competence: "2026-08" }),
    ],
    details: [],
    partners: [{ id: "a7connect", name: "A7CONNECT" }],
    competencies: ["2026-08"],
  });
  const reAlta = snapshot.scopes[0].metrics.find((item) => item.id === "re-alta-fixa");
  assert.deepEqual([reAlta.latest.numerator, reAlta.latest.denominator], [2, 171]);
});

test("prioriza o tipo de movimento exato quando há alias prefixado duplicado", () => {
  const snapshot = calculateQscSnapshot({
    movements: [
      metric("CHURN", 206, 0, "% Churn Banda Larga", { competence: "2026-08" }),
      metric("% Churn Banda Larga CHURN", 206, 0, "% Churn Banda Larga", {
        competence: "2026-08",
      }),
      metric("PARQUE BL", 14_204, 0, "% Churn Banda Larga", { competence: "2026-08" }),
      metric("% Churn Banda Larga PARQUE BL", 14_204, 0, "% Churn Banda Larga", {
        competence: "2026-08",
      }),
    ],
    details: [],
    partners: [{ id: "a7connect", name: "A7CONNECT" }],
    competencies: ["2026-08"],
  });
  const churn = snapshot.scopes[0].metrics.find((item) => item.id === "churn-bl");
  assert.deepEqual([churn.latest.numerator, churn.latest.denominator], [206, 14_410]);
});

test("reproduz o denominador de EC Movel com a safra somada ao numerador", () => {
  const snapshot = calculateQscSnapshot({
    movements: [
      metric("BAIXAS PREMATURAS", 140, 0, "Early Churn Movel", { domain: "movel" }),
      metric("ALTAS SAFRA M-9", 713, 0, "Early Churn Movel", { domain: "movel" }),
    ],
    details: [],
    partners: [{ id: "a7connect", name: "A7CONNECT" }],
    competencies: ["2026-09"],
  });
  const earlyChurn = snapshot.scopes[0].metrics.find((item) => item.id === "early-churn-movel");
  assert.deepEqual([earlyChurn.latest.numerator, earlyChurn.latest.denominator], [140, 853]);
});

test("usa a quantidade reportada no TFP Movel", () => {
  const snapshot = calculateQscSnapshot({
    movements: [
      metric("CLIENTE COM FATURA PAGA", 4, 0, "TFP", {
        domain: "movel",
      }),
      metric("CLIENTE SAFRA", 3, 0, "TFP", {
        domain: "movel",
      }),
    ],
    details: [],
    partners: [{ id: "a7connect", name: "A7CONNECT" }],
    competencies: ["2026-09"],
  });
  const tfp = snapshot.scopes[0].metrics.find((item) => item.id === "tfp-movel");
  assert.deepEqual([tfp.latest.numerator, tfp.latest.denominator], [4, 7]);
});

test("reproduz os cinco KPIs de MÃ³vel do resumo normalizado", () => {
  const movements = [
    metric("BAIXAS PREMATURAS", 140, 0, "Early Churn Movel", { domain: "movel" }),
    metric("ALTAS SAFRA M-9", 713, 0, "Early Churn Movel", { domain: "movel" }),
    metric("SALDO DE PORTABILIDADE", 367, 0, "Saldo de Portabilidade/Altas", {
      domain: "movel",
    }),
    metric("ALTAS", 741, 0, "Saldo de Portabilidade/Altas", { domain: "movel" }),
    metric("CLIENTE TOTALIZADO", 55, 0, "% Totalizacao Altas Movel", { domain: "movel" }),
    metric("CLIENTE POTENCIAL", 19, 0, "% Totalizacao Altas Movel", { domain: "movel" }),
    metric("ALTA DIGITALIZADA", 42, 0, "% Digitalizacao Altas (Movel + Servicos Digitais)", {
      domain: "movel",
    }),
    metric("CLIENTE POTENCIAL", 324, 0, "% Digitalizacao Altas (Movel + Servicos Digitais)", {
      domain: "movel",
    }),
    metric("CLIENTE COM FATURA PAGA", 374, 0, "TFP", {
      domain: "movel",
      documentCount: 374,
    }),
    metric("CLIENTE SAFRA", 73, 0, "TFP", {
      domain: "movel",
      documentCount: 73,
    }),
  ];
  const snapshot = calculateQscSnapshot({
    movements,
    details: [],
    partners: [{ id: "a7connect", name: "A7CONNECT" }],
    competencies: ["2026-09"],
  });
  const metrics = snapshot.scopes[0].metrics.filter((item) => item.domain === "movel");
  assert.deepEqual(
    metrics.map((item) => [
      item.id,
      item.latest.numerator,
      item.latest.denominator,
      item.latest.score,
    ]),
    [
      ["early-churn-movel", 140, 853, 18],
      ["saldo-portabilidade", 367, 741, 14],
      ["totalizacao-movel", 55, 74, 15],
      ["digitalizacao-movel", 42, 366, 15],
      ["tfp-movel", 374, 447, 10],
    ],
  );
});

test("reproduz os KPIs divergentes de Fixa do resumo de setembro", () => {
  const movements = [
    metric("CLIENTE DIGITALIZADO", 7, 0, "Digitalizacao Altas (Fixa Basica + Servicos Digitais)", {
      domain: "fixa",
    }),
    metric("CLIENTE POTENCIAL", 130, 0, "Digitalizacao Altas (Fixa Basica + Servicos Digitais)", {
      domain: "fixa",
    }),
    metric("ACEITE VALIDO", 116, 0, "Qualidade Aceite", { domain: "fixa" }),
    metric("ATIVACAO CLIENTE", 16, 0, "Qualidade Aceite", { domain: "fixa" }),
  ];
  const snapshot = calculateQscSnapshot({
    movements,
    details: [],
    partners: [{ id: "a7connect", name: "A7CONNECT" }],
    competencies: ["2026-09"],
  });
  const metrics = snapshot.scopes[0].metrics.filter((item) => item.domain === "fixa");

  assert.deepEqual(
    metrics
      .filter((item) => ["digitalizacao-fixa", "aceite-digital"].includes(item.id))
      .map((item) => [item.id, item.latest.numerator, item.latest.denominator, item.latest.score]),
    [
      ["digitalizacao-fixa", 7, 137, 3],
      ["aceite-digital", 116, 132, 20],
    ],
  );
});
