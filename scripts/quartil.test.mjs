import test from "node:test";
import assert from "node:assert/strict";
import { buildQuartilSnapshot, quartil, monthOffset, parseMonth } from "./quartil.mjs";

test("quartis independentes, limites inclusivos e zeros", () => {
  assert.deepEqual(quartil({ receita: 2000, movel: 21, ftth: 15 }, "experienced"), {
    receita: 1,
    movel: 1,
    ftth: 1,
  });
  assert.deepEqual(quartil({ receita: 499.99, movel: 20, ftth: 10 }, "experienced"), {
    receita: 5,
    movel: 2,
    ftth: 2,
  });
  for (const [metric, bounds] of Object.entries({
    receita: [2000, 1500, 1000, 500],
    movel: [21, 16, 11, 6],
    ftth: [15, 10, 6, 3],
  })) {
    bounds.forEach((value, index) => {
      assert.equal(quartil({ [metric]: value }, "experienced")[metric], index + 1);
      assert.equal(quartil({ [metric]: value - 0.01 }, "experienced")[metric], index + 2);
    });
  }
  assert.deepEqual(quartil({ receita: 0, movel: 0, ftth: 0 }, "new"), {
    receita: 5,
    movel: 5,
    ftth: 5,
  });
  assert.deepEqual(quartil({ receita: 1000, movel: 16, ftth: 10 }, "new"), {
    receita: 1,
    movel: 1,
    ftth: 1,
  });
  assert.equal(quartil({ receita: null }, "new").receita, null);
  assert.equal(quartil({ receita: 1000 }, null), null);
});
const headers = [
  "Consultor",
  "Parceiro",
  "M de CASA",
  "RECEITA TELECOM TT",
  "FISICOS MÓVEL",
  "FISICOS FTTH",
];
const row = (name, partner, amount) => [name, partner, "ACIMA DE M3", amount, 21, 15];
test("coorte atual, parceiros separados, 3/6 meses, nomes normalizados e deduplicação", () => {
  const data = buildQuartilSnapshot(
    [
      {
        name: "Ago_26",
        rows: [headers, row("Ana", "A7", 2000), row("Bia", "A7", 500), row("Ana", "Outro", 0)],
      },
      {
        name: "Mai_26",
        rows: [headers, row("ANA", "a7", 500), row("ANA", "a7", 500), row("Saiu", "A7", 2000)],
      },
      { name: "Fev_26", rows: [headers, row("Ana", "A7", 1500)] },
    ],
    "modelo.xlsx",
  );
  assert.equal(data.consultants.length, 3);
  assert.equal(data.partners.length, 2);
  const ana = data.consultants.find((c) => c.name === "Ana" && c.partnerName === "A7");
  assert.equal(ana.history.length, 3);
  assert.equal(ana.comparisons[3].changes.receita, 3);
  assert.equal(ana.comparisons[6].changes.receita, 1);
  assert.equal(data.consultants.find((c) => c.name === "Bia").comparisons[3].changes.receita, null);
  assert.ok(!data.consultants.some((c) => c.name === "Saiu"));
  assert.throws(
    () =>
      buildQuartilSnapshot(
        [{ name: "Ago_26", rows: [headers, row("Ana", "A7", 1), row("Ana", "A7", 2)] }],
        "bad.xlsx",
      ),
    /valores diferentes/,
  );
});
test("calendário, histórico faltante e coluna Praceiro do modelo", () => {
  assert.equal(monthOffset("2026-02", -6), "2025-08");
  assert.equal(parseMonth("Abr_26 "), "2026-04");
  assert.equal(parseMonth("TABELA DE CONSULTORES"), null);
  const data = buildQuartilSnapshot(
    [
      {
        name: "Ago_26",
        rows: [headers.map((h) => (h === "Parceiro" ? "Praceiro" : h)), row("Ana", "A7", 500)],
      },
    ],
    "modelo.xlsx",
  );
  assert.equal(data.consultants[0].comparisons[6].changes.receita, null);
});
