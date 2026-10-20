import { normalizeHeader, parseNumber } from "./spreadsheet-reader.mjs";

/**
 * Invasão de carteira: altas vendidas fora da carteira do parceiro.
 *
 * Regras de negócio (colunas da base BI, comparadas sem acento nem caixa):
 * - Altas Móvel: Venda na Carteira = "Altas Invasão", Tipo = "MOVEL", Produto = "VOZ MOVEL".
 * - Altas FTTH: Venda na Carteira = "Altas Invasão", Tipo = "FIXA BASICA", Produto = "BANDA LARGA".
 * Ambas somam a coluna "Qtde. Ativação".
 * Mês de exercício: coluna AnoMês (AAAAMM). Parceiro: coluna Grupo Rede Termo Carteira.
 */
export const INVASAO_RULES = {
  sale: "ALTASINVASAO",
  movel: { type: "MOVEL", product: "VOZMOVEL" },
  ftth: { type: "FIXABASICA", product: "BANDALARGA" },
};

const REQUIRED_COLUMNS = {
  month: "ANOMES",
  partner: "GRUPOREDETERMOCARTEIRA",
  type: "TIPO",
  sale: "VENDANACARTEIRA",
  product: "PRODUTO",
  directorate: "DIRETORIAHABILITADOR",
  quantity: "QTDEATIVACAO",
};
const COLUMN_LABELS = {
  month: "AnoMês",
  partner: "Grupo Rede Termo Carteira",
  type: "Tipo",
  sale: "Venda na Carteira",
  product: "Produto",
  directorate: "Diretoria Habilitador",
  quantity: "Qtde. Ativação",
};
const UNKNOWN_DIRECTORATE = "Não informado";

export function parseYearMonth(value) {
  const match = String(value ?? "")
    .trim()
    .match(/^(\d{4})(\d{2})$/);
  if (!match) return null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? `${match[1]}-${match[2]}` : null;
}

function partnerSlug(name) {
  return name
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Linhas da planilha (primeira linha com cabeçalho) -> resumo por parceiro, mês e diretoria. */
export function buildInvasaoSnapshot(rows, sourceName) {
  const headerIndex = rows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return headers.includes(REQUIRED_COLUMNS.month) && headers.includes(REQUIRED_COLUMNS.sale);
  });
  if (headerIndex < 0) throw new Error("Cabeçalho da base de invasão de carteira não encontrado.");
  const headers = rows[headerIndex].map(normalizeHeader);
  const columns = Object.fromEntries(
    Object.entries(REQUIRED_COLUMNS).map(([key, header]) => [key, headers.indexOf(header)]),
  );
  const missing = Object.entries(columns)
    .filter(([, index]) => index < 0)
    .map(([key]) => COLUMN_LABELS[key]);
  if (missing.length)
    throw new Error(`Colunas ausentes na base de invasão: ${missing.join(", ")}.`);

  const periods = new Map();
  const totals = new Map();
  for (const row of rows.slice(headerIndex + 1)) {
    // Rodapés do BI ("Total", "Filtros aplicados") não têm um AnoMês válido.
    const month = parseYearMonth(row[columns.month]);
    const partnerName = String(row[columns.partner] ?? "").trim();
    if (!month || !partnerName) continue;
    const partnerId = partnerSlug(partnerName);
    periods.set(`${partnerId}|${month}`, { partnerId, partnerName, month });

    if (normalizeHeader(row[columns.sale]) !== INVASAO_RULES.sale) continue;
    const type = normalizeHeader(row[columns.type]);
    const product = normalizeHeader(row[columns.product]);
    const isMovel = type === INVASAO_RULES.movel.type && product === INVASAO_RULES.movel.product;
    const isFtth = type === INVASAO_RULES.ftth.type && product === INVASAO_RULES.ftth.product;
    if (!isMovel && !isFtth) continue;

    const directorate = String(row[columns.directorate] ?? "").trim() || UNKNOWN_DIRECTORATE;
    const key = `${partnerId}|${month}|${normalizeHeader(directorate)}`;
    const record = totals.get(key) ?? {
      partnerId,
      partnerName,
      month,
      directorate,
      altasMovel: 0,
      altasFtth: 0,
    };
    const quantity = parseNumber(row[columns.quantity]);
    if (isMovel) record.altasMovel += quantity;
    else record.altasFtth += quantity;
    totals.set(key, record);
  }
  if (!periods.size) throw new Error("Nenhum parceiro com AnoMês válido na base de invasão.");
  return finalizeSnapshot([...periods.values()], [...totals.values()], sourceName);
}

function finalizeSnapshot(periods, records, sourceName) {
  const sortedPeriods = [...periods].sort(
    (a, b) => a.month.localeCompare(b.month) || a.partnerName.localeCompare(b.partnerName),
  );
  const months = [...new Set(sortedPeriods.map((period) => period.month))];
  return {
    source: { report: sourceName, importedAt: new Date().toISOString() },
    latestMonth: months.at(-1) ?? "",
    months,
    partners: [
      ...new Map(
        sortedPeriods.map((period) => [
          period.partnerId,
          { id: period.partnerId, name: period.partnerName },
        ]),
      ).values(),
    ],
    periods: sortedPeriods,
    records: [...records].sort(
      (a, b) =>
        a.month.localeCompare(b.month) ||
        a.partnerName.localeCompare(b.partnerName) ||
        a.directorate.localeCompare(b.directorate, "pt-BR"),
    ),
  };
}

/**
 * Uma nova carga substitui apenas os pares parceiro + mês que ela traz; o restante da
 * base já importada (outros parceiros ou meses) é preservado.
 */
export function mergeInvasaoSnapshots(previous, next) {
  if (!previous?.periods?.length) return next;
  const replaced = new Set(next.periods.map((period) => `${period.partnerId}|${period.month}`));
  const keep = (item) => !replaced.has(`${item.partnerId}|${item.month}`);
  return finalizeSnapshot(
    [...previous.periods.filter(keep), ...next.periods],
    [...previous.records.filter(keep), ...next.records],
    next.source.report,
  );
}
