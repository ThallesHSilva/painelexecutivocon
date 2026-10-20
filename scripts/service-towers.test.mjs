import test from "node:test";
import assert from "node:assert/strict";
import { buildServiceTowers } from "./service-towers.mjs";

const layouts = [
  ["Altas Móvel", 4, 4, ["Forecast", "Esteira", "Ativado", "BG", "BG x PC"]],
  ["Aparelhos ", 32, 32, ["Forecast", "BRUTO", "LIQUIDO", "Best Guess", "BG x PC"]],
  ["BANDA LARGA", 44, 44, ["Forecast", "Emissões", "Ativado", "BG", "BG x PC"]],
  ["Dados Avançados", 56, 56, ["Forecast", "Esteira", "Ativado", "Est x PC", "Bruto"]],
  ["VVN", 64, 65, ["Forecast", "Esteira", "Ativado", "Best Guess", "Est x PC", "Bruto", "Est"]],
  ["Voz (SIP / 0800)", 74, 76, ["Forecast", "Esteira", "Ativado", "Est x PC", "Bruto"]],
  ["TI Recorrente", 101, 104, ["Forecast", "ATIVADO", "Best Guess", "Est x PC", "Bruto"]],
  ["Vivo Tech", 110, 113, ["Forecast", "Esteira", "Est x PC", "Bruto"]],
];

function fixture(modern = true, partners = 2) {
  const rows = [[], [], []];
  const total = partners + 4;
  for (const [title, oldStart, newStart, labels] of layouts) {
    const start = modern ? newStart : oldStart;
    const names = modern ? labels : labels.filter((label) => !(label === "Ativado" && start >= 56));
    rows[1][start] = title;
    rows[2][start - 2] = "RK";
    rows[2][start] = "NM_REDE";
    names.forEach((label, offset) => (rows[2][start + offset + 1] = label));
    for (let p = 0; p < partners; p++) {
      const row = (rows[p + 3] ??= []);
      row[start] = `Parceiro ${p + 1}`;
      names.forEach(
        (label, offset) => (row[start + offset + 1] = /x PC/.test(label) ? "0.25" : "100"),
      );
    }
    (rows[total - 1] ??= [])[start] = "";
    (rows[total] ??= [])[start] = "TT";
    names.forEach(
      (label, offset) => (rows[total][start + offset + 1] = /x PC/.test(label) ? "0.4" : "900"),
    );
    (rows[total + 3] ??= [])[start] = "Gestor — não é parceiro";
    (rows[total + 4] ??= [])[start] = "TT";
  }
  // Unimported products must still delimit the preceding supported tower.
  for (const [start, title] of [
    [19, "Renovação Móvel"],
    [85, "VOZ + VVN"],
    [95, "VOZ + VVN"],
    [119, "OUT_26"],
  ]) {
    rows[1][start] = title;
    rows[2][start - 2] = "RK";
    rows[2][start] = "NM_REDE";
    rows[2][start + 1] = "Não importar";
    rows[3][start + 1] = "999999";
  }
  return rows;
}

for (const modern of [false, true]) {
  test(`modelo ${modern ? "novo" : "anterior"}: blocos, parceiros e percentuais TT corretos`, () => {
    const towers = buildServiceTowers(fixture(modern));
    assert.equal(towers.length, 8);
    for (const tower of towers) {
      assert.equal(tower.rows.length, 2);
      assert.equal(tower.rows[0].partner, "Parceiro 1");
      assert.ok(
        !tower.columns.some((column) => ["RK", "NM_REDE", "Não importar"].includes(column.label)),
      );
      const forecast = tower.columns.find((column) => column.label === "Forecast");
      assert.equal(tower.rows[0].values[forecast.key], 100);
      assert.equal(tower.total[forecast.key], 900);
      const percent = tower.columns.find((column) => column.format === "percent");
      assert.equal(tower.total[percent.key], 0.4, "TT is authoritative, not the sum 0.5");
      assert.ok(
        tower.columns.some((column) => column.label === "BRUTO") === (tower.id === "aparelhos"),
      );
    }
    const vvn = towers.find((tower) => tower.id === "vvn");
    assert.equal(vvn.columns[0].key, modern ? "c66" : "c65");
    assert.equal(
      vvn.columns.some((column) => column.label === "Ativado"),
      modern,
    );
  });
}

test("não limita parceiros a 19 linhas e acha cabeçalho com metadados extras", () => {
  const rows = fixture(true, 25);
  const towers = buildServiceTowers([[], [], ...rows]);
  assert.ok(towers.every((tower) => tower.rows.length === 25));
});

test("Ativado, zero, campo ausente e erro de fórmula mantêm semântica", () => {
  const rows = fixture();
  rows[3][68] = "0";
  rows[4][68] = "#DIV/0!";
  rows[3][69] = "";
  const vvn = buildServiceTowers(rows).find((tower) => tower.id === "vvn");
  assert.equal(vvn.rows[0].values.c68, 0);
  assert.equal(vvn.rows[1].values.c68, null);
  assert.equal(vvn.rows[0].values.c69, null);
});

test("omite ajustes com serial de data, preserva coluna sem título com dados", () => {
  const rows = fixture();
  rows[1][15] = "Ajustes";
  rows[2][15] = "46300";
  rows[3][15] = "123";
  rows[2][66] = "";
  const towers = buildServiceTowers(rows);
  assert.ok(!towers[0].columns.some((column) => column.label === "46300"));
  const vvn = towers.find((tower) => tower.id === "vvn");
  assert.equal(vvn.columns.find((column) => column.key === "c66").label, "Indicador 1");
  assert.equal(vvn.rows[0].values.c66, 100);
});

test("falha em cabeçalho ausente, produto ambíguo e TT ausente em vez de importar deslocado", () => {
  assert.throws(() => buildServiceTowers([[]]), /Cabeçalhos/);
  const missing = fixture();
  missing[1][65] = "Outro produto";
  assert.throws(() => buildServiceTowers(missing), /VVN.*não encontrado/);
  const ambiguous = fixture();
  ambiguous[1][85] = "VVN";
  assert.throws(() => buildServiceTowers(ambiguous), /VVN.*ambíguo/);
  const withoutTotal = fixture().slice(0, 6);
  assert.throws(() => buildServiceTowers(withoutTotal), /TT não encontrado/);
});

test("TT ausente no bloco principal não usa TT da seção inferior de gestores", () => {
  const rows = fixture();
  rows[6][65] = "";
  assert.throws(() => buildServiceTowers(rows), /VVN.*TT não encontrado/);
});
