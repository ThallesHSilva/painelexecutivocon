/** Column contract for Resultados YoY workbooks with variable spacer columns. */
export type ResultadosYoyColumns = {
  product: number;
  company: number;
  meta: number;
  real: number;
  attainment: number;
  gap: number;
  average: number;
  previousMeta: number;
  previousReal: number;
  previousAttainment: number;
  previousGap: number;
  previousAverage: number;
  yoy: number;
  yoyGap: number;
};

const normalizeHeader = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLocaleLowerCase("pt-BR");

const isMetaHeader = (value: unknown) => {
  const normalized = normalizeHeader(value);
  return normalized === "meta" || /^meta20\d{2}$/.test(normalized);
};

const isRealHeader = (value: unknown) => {
  const normalized = normalizeHeader(value);
  return normalized === "real" || /^real20\d{2}$/.test(normalized);
};

export function resultadosYoyColumns(header: unknown[]): ResultadosYoyColumns {
  const company = header.findIndex((value) => normalizeHeader(value) === "nomerede");
  const metas = header
    .map((value, index) => (isMetaHeader(value) && isRealHeader(header[index + 1]) ? index : -1))
    .filter((index) => index > company);
  const meta = metas[0] ?? 4;
  const previousMeta = metas[1] ?? meta + 7;

  return {
    product: 0,
    company: company >= 0 ? company : 2,
    meta,
    real: meta + 1,
    attainment: meta + 2,
    gap: meta + 3,
    average: meta + 5,
    previousMeta,
    previousReal: previousMeta + 1,
    previousAttainment: previousMeta + 2,
    previousGap: previousMeta + 3,
    previousAverage: previousMeta + 5,
    yoy: previousMeta + 7,
    yoyGap: previousMeta + 8,
  };
}

export function resultadosYoyCells(row: unknown[], columns: ResultadosYoyColumns) {
  return {
    product: row[columns.product],
    company: row[columns.company],
    meta: row[columns.meta],
    real: row[columns.real],
    attainment: row[columns.attainment],
    gap: row[columns.gap],
    average: row[columns.average],
    previousMeta: row[columns.previousMeta],
    previousReal: row[columns.previousReal],
    previousAttainment: row[columns.previousAttainment],
    previousGap: row[columns.previousGap],
    previousAverage: row[columns.previousAverage],
    yoy: row[columns.yoy],
    yoyGap: row[columns.yoyGap],
  };
}
