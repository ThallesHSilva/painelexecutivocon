import assert from "node:assert/strict";
import test from "node:test";
import { aggregateRecords, parseQscSummaryRows } from "./process-qsc-summary.mjs";

const filters = (type) =>
  `Filtros aplicados:\nTIPO_QSC é ${type}\nGRUPO_REDE_TERMO é VITALE TELECOM\nanomestxt é 202609\nTIPO_QSC não é (Em branco)`;

test("lê o QSC simples pelos filtros aplicados e preserva os valores reportados", () => {
  const parsed = parseQscSummaryRows(
    [
      ["-", "Diretoria", "Resultado", "KPI 1", "KPI 2", "%", "Nota", "Faixa_resumo"],
      ["Movel", "CONSULTIVO", "Digitalização Score", 10, 104, 0.0961, 15, "1"],
      ["Movel", "CONSULTIVO", "Total", 10, 104, 0.0961, 15, "C"],
      [filters("Movel")],
    ],
    "Resumo_Móvel.xlsx",
  );

  assert.equal(parsed.domain, "movel");
  assert.equal(parsed.partnerName, "VITALE TELECOM");
  assert.equal(parsed.competence, "2026-09");
  assert.deepEqual(parsed.records[0], {
    id: "digitalizacao-movel",
    domain: "movel",
    result: "Digitalização Score",
    competence: "2026-09",
    partnerName: "VITALE TELECOM",
    kpi1: 10,
    kpi2: 104,
    percent: 0.0961,
    note: 15,
    band: "1",
  });
});

test("mapeia Banda Larga para o domínio interno fixa e mantém nota vazia", () => {
  const parsed = parseQscSummaryRows([
    ["-", "Diretoria", "Resultado", "KPI 1", "KPI 2", "%", "Nota", "Faixa_resumo"],
    ["Banda Larga", "CONSULTIVO", "% Cancelamento Comercial", 9, 47, 0.1914, "", ""],
    [filters("Banda Larga")],
  ]);

  assert.equal(parsed.domain, "fixa");
  assert.equal(parsed.records[0].id, "cancelamento-comercial");
  assert.equal(parsed.records[0].note, null);
  assert.equal(parsed.records[0].band, null);
});

test("recalcula a nota consolidada pela faixa em vez de somar notas dos parceiros", () => {
  const consolidated = aggregateRecords([
    {
      id: "digitalizacao-movel",
      domain: "movel",
      result: "% Digitalizacao das altas",
      competence: "2026-09",
      partnerName: "PARCEIRO A",
      kpi1: 4,
      kpi2: 50,
      percent: 0.08,
      note: 15,
      band: "1",
    },
    {
      id: "digitalizacao-movel",
      domain: "movel",
      result: "% Digitalizacao das altas",
      competence: "2026-09",
      partnerName: "PARCEIRO B",
      kpi1: 4,
      kpi2: 50,
      percent: 0.08,
      note: 15,
      band: "1",
    },
  ]);

  assert.deepEqual(
    [consolidated[0].kpi1, consolidated[0].kpi2, consolidated[0].percent],
    [8, 100, 0.08],
  );
  assert.deepEqual([consolidated[0].note, consolidated[0].band], [15, "1"]);
});
