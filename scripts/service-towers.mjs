import { normalizeHeader, parseNumber } from "./spreadsheet-reader.mjs";

const DEFINITIONS = [
  { id: "altas-movel", title: "Altas Móvel" },
  { id: "aparelhos", title: "Aparelhos" },
  { id: "banda-larga", title: "Banda Larga" },
  { id: "dados-avancados", title: "Dados Avançados" },
  { id: "vvn", title: "VVN" },
  { id: "voz", title: "Voz (SIP / 0800)" },
  { id: "ti-recorrente", title: "TI Recorrente" },
  { id: "vivo-tech", title: "Vivo Tech" },
];

function clean(value) {
  const text = String(value ?? "").trim();
  return text === "" || text.startsWith("#") ? null : text;
}

function value(value) {
  const text = clean(value);
  if (text == null) return null;
  const parsed = parseNumber(text);
  return Number.isFinite(parsed) && /[0-9]/.test(text) ? parsed : text;
}

const isPartnerHeader = (value) => ["NMREDE", "NOMEREDE"].includes(normalizeHeader(value));

/** Locate product blocks by their headers, never by column offsets. */
export function buildServiceTowers(rows) {
  const headerIndex = rows.findIndex(
    (row, index) =>
      row.filter(isPartnerHeader).length >= 2 &&
      DEFINITIONS.some((definition) =>
        row.some(
          (cell, column) =>
            isPartnerHeader(cell) &&
            normalizeHeader(rows[index - 1]?.[column]) === normalizeHeader(definition.title),
        ),
      ),
  );
  if (headerIndex < 0)
    throw new Error("Cabeçalhos das Torres de serviço (NM_REDE) não encontrados.");
  const titles = rows[headerIndex - 1];
  const headers = rows[headerIndex];
  const partnerColumns = headers.flatMap((cell, index) => (isPartnerHeader(cell) ? [index] : []));

  return DEFINITIONS.map((definition) => {
    const matches = partnerColumns.filter(
      (index) => normalizeHeader(titles[index]) === normalizeHeader(definition.title),
    );
    if (matches.length !== 1)
      throw new Error(
        `Torre ${definition.title}: cabeçalho ${matches.length ? "ambíguo" : "não encontrado"}.`,
      );
    const start = matches[0];
    const next = partnerColumns.find((index) => index > start) ?? headers.length;
    // The next product's RK and its separator cells do not belong to this product.
    const rank = headers.findIndex(
      (cell, index) => index > start && index < next && normalizeHeader(cell) === "RK",
    );
    const end = rank < 0 ? next : rank;
    let totalIndex = -1;
    let hasPartners = false;
    let afterPartners = false;
    for (let index = headerIndex + 1; index < rows.length; index++) {
      const partner = clean(rows[index]?.[start]);
      if (normalizeHeader(partner) === "TT") {
        totalIndex = index;
        break;
      }
      if (!partner) {
        if (hasPartners) afterPartners = true;
        continue;
      }
      // A new named block after the closing gap is not another partner block.
      // Never borrow its TT when the partner total was removed from the workbook.
      if (afterPartners || isPartnerHeader(partner)) break;
      hasPartners = true;
    }
    if (totalIndex < 0)
      throw new Error(`Torre ${definition.title}: total TT não encontrado no bloco de parceiros.`);
    const records = rows.slice(headerIndex + 1, totalIndex);
    const totalRecord = rows[totalIndex];
    const hidden = new Set([
      ...(definition.id === "altas-movel" ? ["DEAL?", "BIG DEAL"] : []),
      ...(definition.id !== "aparelhos" ? ["BRUTO"] : []),
    ]);
    const columns = Array.from({ length: end - start - 1 }, (_, offset) => {
      const index = start + offset + 1;
      const label = clean(headers[index]);
      if (!label && ![...records, totalRecord].some((row) => clean(row[index]) !== null))
        return null;
      if (
        hidden.has(label?.toUpperCase()) ||
        (definition.id === "altas-movel" && /^\d{5}$/.test(label ?? ""))
      )
        return null;
      const name = label ?? `Indicador ${offset + 1}`;
      return {
        key: `c${index}`,
        label: name,
        format: /%|X PC/i.test(name) ? "percent" : "number",
        index,
      };
    }).filter(Boolean);
    const towerRows = records
      .filter((row) => clean(row[start]))
      .map((row) => ({
        partner: clean(row[start]),
        values: Object.fromEntries(columns.map((column) => [column.key, value(row[column.index])])),
      }));
    if (!towerRows.length)
      throw new Error(`Torre ${definition.title}: não foram encontradas linhas de parceiros.`);
    return {
      ...definition,
      sourceTitle: clean(titles[start]),
      columns: columns.map(({ index, ...column }) => column),
      rows: towerRows,
      // Percentages and totals remain authoritative spreadsheet values, never sums of ratios.
      total: Object.fromEntries(
        columns.map((column) => [column.key, value(totalRecord[column.index])]),
      ),
    };
  });
}
