import test from "node:test";
import assert from "node:assert/strict";
import {
  buildInvasaoSnapshot,
  mergeInvasaoSnapshots,
  parseYearMonth,
} from "./invasao-carteira.mjs";

const headers = [
  "AnoMês",
  "Tipo",
  "Grupo Rede Termo Carteira",
  "Venda na Carteira",
  "Diretoria Habilitador",
  "Produto",
  "Qtde. Ativação",
];
const row = (month, type, partner, sale, directorate, product, quantity) => [
  month,
  type,
  partner,
  sale,
  directorate,
  product,
  quantity,
];

test("soma só Altas Invasão de VOZ MOVEL e BANDA LARGA, por diretoria", () => {
  const data = buildInvasaoSnapshot(
    [
      headers,
      row("202609", "MOVEL", "VITALE TELECOM", "Altas Invasão", "CONSULTIVO", "VOZ MOVEL", "3"),
      row("202609", "MOVEL", "VITALE TELECOM", "Altas Invasão", "CONSULTIVO", "VOZ MOVEL", 2),
      row("202609", "MOVEL", "VITALE TELECOM", "Altas Invasão", "INBOUND", "VOZ MOVEL", 4),
      row(
        "202609",
        "FIXA BASICA",
        "VITALE TELECOM",
        "Altas Invasão",
        "CONSULTIVO",
        "BANDA LARGA",
        5,
      ),
      // Fora da regra: outra venda, outro tipo e outro produto.
      row("202609", "MOVEL", "VITALE TELECOM", "Altas Carteira", "CONSULTIVO", "VOZ MOVEL", 100),
      row(
        "202609",
        "RENOVACAO MOVEL",
        "VITALE TELECOM",
        "Altas Invasão",
        "CONSULTIVO",
        "VOZ MOVEL",
        100,
      ),
      row("202609", "FIXA BASICA", "VITALE TELECOM", "Altas Invasão", "CONSULTIVO", "Skeelo", 100),
      row(
        "202609",
        "FIXA BASICA",
        "VITALE TELECOM",
        "Altas Invasão",
        "CONSULTIVO",
        "VOZ FIXA",
        100,
      ),
      // Rodapés do BI.
      ["Total", "", "", "", "", "", 999],
      ["Filtros aplicados:\r\nANOMES é 202609"],
    ],
    "base.xlsx",
  );
  assert.equal(data.latestMonth, "2026-09");
  assert.deepEqual(data.partners, [{ id: "vitale-telecom", name: "VITALE TELECOM" }]);
  assert.deepEqual(
    data.records.map(({ directorate, altasMovel, altasFtth }) => [
      directorate,
      altasMovel,
      altasFtth,
    ]),
    [
      ["CONSULTIVO", 5, 5],
      ["INBOUND", 4, 0],
    ],
  );
});

test("compara texto sem acento, caixa ou espaços e usa 'Não informado' sem diretoria", () => {
  const data = buildInvasaoSnapshot(
    [headers, row(202609, " movel ", "Vitale Telecom", "ALTAS INVASAO", "", "voz móvel", "1,0")],
    "base.xlsx",
  );
  assert.equal(data.records.length, 1);
  assert.equal(data.records[0].directorate, "Não informado");
  assert.equal(data.records[0].altasMovel, 1);
});

test("parceiro sem invasão continua listado e a base sem colunas obrigatórias é recusada", () => {
  const data = buildInvasaoSnapshot(
    [headers, row("202609", "MOVEL", "OUTRO", "Altas Carteira", "CONSULTIVO", "VOZ MOVEL", 7)],
    "base.xlsx",
  );
  assert.equal(data.records.length, 0);
  assert.equal(data.periods.length, 1);
  assert.throws(
    () =>
      buildInvasaoSnapshot(
        [
          ["AnoMês", "Venda na Carteira"],
          ["202609", "x"],
        ],
        "base.xlsx",
      ),
    /Colunas ausentes/,
  );
  assert.equal(parseYearMonth("202613"), null);
  assert.equal(parseYearMonth("Total"), null);
});

test("nova carga substitui só os pares parceiro + mês enviados", () => {
  const build = (month, partner, quantity) =>
    buildInvasaoSnapshot(
      [headers, row(month, "MOVEL", partner, "Altas Invasão", "CONSULTIVO", "VOZ MOVEL", quantity)],
      `${partner}-${month}.xlsx`,
    );
  let data = build("202608", "A7 CONNECT", 10);
  data = mergeInvasaoSnapshots(data, build("202609", "A7 CONNECT", 20));
  data = mergeInvasaoSnapshots(data, build("202609", "VITALE TELECOM", 30));
  data = mergeInvasaoSnapshots(data, build("202609", "A7 CONNECT", 25));
  assert.deepEqual(data.months, ["2026-08", "2026-09"]);
  assert.equal(data.partners.length, 2);
  assert.deepEqual(
    data.records.map((record) => [record.month, record.partnerName, record.altasMovel]),
    [
      ["2026-08", "A7 CONNECT", 10],
      ["2026-09", "A7 CONNECT", 25],
      ["2026-09", "VITALE TELECOM", 30],
    ],
  );
});
