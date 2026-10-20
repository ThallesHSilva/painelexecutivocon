import { normalizeHeader } from "./spreadsheet-reader.mjs";

// Boundaries are inclusive. Q1 is the strongest performance.
export const QUARTIL_RULES = {
  experienced: { receita: [2000, 1500, 1000, 500], movel: [21, 16, 11, 6], ftth: [15, 10, 6, 3] },
  new: { receita: [500, 251, 100, Number.MIN_VALUE], movel: [16, 11, 6, 1], ftth: [10, 6, 3, 1] },
};
export function quartil(value, tenure) {
  if (value === null || tenure === null) return null;
  const rules = QUARTIL_RULES[tenure];
  return Object.fromEntries(
    Object.entries(value).map(([metric, amount]) => [
      metric,
      amount === null ? null : rules[metric].findIndex((minimum) => amount >= minimum) + 1 || 5,
    ]),
  );
}
export function monthOffset(month, offset) {
  const [year, number] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, number - 1 + offset, 1));
  return date.toISOString().slice(0, 7);
}
export function parseMonth(name) {
  const key = normalizeHeader(name);
  const names = [
    "JAN",
    "FEV",
    "MAR",
    "ABR",
    "MAI",
    "JUN",
    "JUL",
    "AGO",
    "SET",
    "OUT",
    "NOV",
    "DEZ",
  ];
  const match = key.match(/^([A-Z]+)(\d{2}|\d{4})$/);
  const month = match ? names.findIndex((prefix) => match[1].startsWith(prefix)) + 1 : 0;
  if (!month) return null;
  return `${match[2].length === 2 ? `20${match[2]}` : match[2]}-${String(month).padStart(2, "0")}`;
}
export function buildQuartilSnapshot(sheets, sourceName) {
  const records = [];
  const months = new Set();
  const seen = new Map();
  const warnings = [];
  for (const sheet of sheets) {
    const month = parseMonth(sheet.name);
    if (!month) continue;
    const headerIndex = sheet.rows.findIndex((row) =>
      row.map(normalizeHeader).includes("CONSULTOR"),
    );
    if (headerIndex < 0) throw new Error(`Aba ${sheet.name}: coluna Consultor ausente.`);
    const headers = sheet.rows[headerIndex].map(normalizeHeader);
    const columns = {
      name: headers.indexOf("CONSULTOR"),
      partner: headers.findIndex((h) => ["PARCEIRO", "PRACEIRO"].includes(h)),
      tenure: headers.indexOf("MDECASA"),
      days: headers.indexOf("TEMPODECASA"),
      receita: headers.indexOf("RECEITATELECOMTT"),
      movel: headers.indexOf("FISICOSMOVEL"),
      ftth: headers.indexOf("FISICOSFTTH"),
    };
    if ([columns.partner, columns.receita, columns.movel, columns.ftth].some((i) => i < 0))
      throw new Error(
        `Aba ${sheet.name}: informe Parceiro, RECEITA TELECOM TT, FISICOS MÓVEL e FISICOS FTTH.`,
      );
    let count = 0;
    for (const [index, row] of sheet.rows.entries()) {
      if (index <= headerIndex) continue;
      const name = String(row[columns.name] ?? "").trim();
      if (!name || /^(TOTAL|TOTAL GERAL)$/i.test(name)) continue;
      const partnerName = String(row[columns.partner] ?? "").trim();
      if (!partnerName)
        throw new Error(`Aba ${sheet.name}, linha ${index + 1}: consultor sem Parceiro.`);
      const partnerId = partnerName
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const id = `${normalizeHeader(partnerName)}:${normalizeHeader(name)}`;
      const key = `${month}:${id}`;
      const tenureText = normalizeHeader(row[columns.tenure]);
      const daysRaw = row[columns.days];
      const days =
        daysRaw !== "" && daysRaw != null && Number.isFinite(Number(daysRaw))
          ? Number(daysRaw)
          : null;
      const tenure = tenureText.startsWith("ACIMA")
        ? "experienced"
        : tenureText.startsWith("ABAIXO")
          ? "new"
          : days !== null
            ? days > 90
              ? "experienced"
              : "new"
            : null;
      const values = Object.fromEntries(
        ["receita", "movel", "ftth"].map((metric) => {
          const raw = row[columns[metric]];
          const value =
            raw === "" || raw == null
              ? null
              : Number(
                  String(raw).includes(",")
                    ? String(raw).replaceAll(".", "").replace(",", ".")
                    : raw,
                );
          return [metric, value !== null && Number.isFinite(value) && value >= 0 ? value : null];
        }),
      );
      const signature = JSON.stringify({ tenure, values });
      const record = {
        id,
        name,
        partnerId,
        partnerName,
        month,
        tenure,
        values,
        quartiles: quartil(values, tenure) ?? { receita: null, movel: null, ftth: null },
      };
      // Linha totalmente zerada: sobra de duplicidade na planilha, não um resultado real.
      const blank = Object.values(values).every((value) => value === null || value === 0);
      const previous = seen.get(key);
      if (previous) {
        if (previous.signature === signature) continue;
        // Duplicado com uma linha zerada: vale a linha preenchida.
        if (blank) continue;
        if (!previous.blank)
          throw new Error(
            `Aba ${sheet.name}: consultor duplicado com valores diferentes: ${name}.`,
          );
        records[previous.index] = record;
        seen.set(key, { signature, blank, index: previous.index });
        continue;
      }
      seen.set(key, { signature, blank, index: records.length });
      if (tenure === null || Object.values(values).includes(null))
        warnings.push(`${sheet.name}, linha ${index + 1}: dados insuficientes para algum quartil.`);
      records.push(record);
      count++;
    }
    if (count) months.add(month);
  }
  const orderedMonths = [...months].sort();
  const latestMonth = orderedMonths.at(-1);
  if (!latestMonth)
    throw new Error("Nenhuma aba mensal válida com consultores encontrada (ex.: Ago_26).");
  const recordMap = new Map(records.map((row) => [`${row.id}:${row.month}`, row]));
  // Cada parceiro é lido na sua competência mais recente: quem ainda não enviou o mês
  // corrente continua visível com o último mês que tem na planilha, em vez de sumir.
  const partnerLatestMonth = new Map();
  for (const row of records)
    if (row.month > (partnerLatestMonth.get(row.partnerId) ?? ""))
      partnerLatestMonth.set(row.partnerId, row.month);
  const consultants = records
    .filter((row) => row.month === partnerLatestMonth.get(row.partnerId))
    .map((current) => {
      const history = orderedMonths
        .map((month) => recordMap.get(`${current.id}:${month}`))
        .filter(Boolean);
      const comparisons = Object.fromEntries(
        // O mês corrente faz parte da janela: 3 meses = atual + 2 anteriores;
        // 6 meses = atual + 5 anteriores. A janela parte da competência do próprio
        // parceiro, para que a evolução compare o mesmo intervalo de meses.
        [
          [3, -2],
          [6, -5],
        ].map(([period, offset]) => {
          const month = monthOffset(current.month, offset);
          const previous = recordMap.get(`${current.id}:${month}`);
          return [
            period,
            {
              month,
              changes: Object.fromEntries(
                ["receita", "movel", "ftth"].map((metric) => {
                  const before = previous?.quartiles[metric] ?? null;
                  const now = current.quartiles[metric];
                  return [metric, before === null || now === null ? null : before - now];
                }),
              ),
            },
          ];
        }),
      );
      return { ...current, history, comparisons };
    });
  const partners = [
    ...new Map(
      consultants.map((row) => [row.partnerId, { id: row.partnerId, name: row.partnerName }]),
    ).values(),
  ];
  return {
    source: { report: sourceName, importedAt: new Date().toISOString() },
    latestMonth,
    months: orderedMonths,
    partners,
    consultants,
    warnings,
  };
}
