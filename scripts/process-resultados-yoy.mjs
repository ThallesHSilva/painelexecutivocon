import fs from "node:fs/promises";
import path from "node:path";
import { normalizeHeader, parseNumber, readSpreadsheetRows } from "./spreadsheet-reader.mjs";

const inputPath = process.argv[2];
const outputPath = path.resolve(process.argv[3] ?? ".data/snapshots/resultados-yoy.snapshot.json");
if (!inputPath) throw new Error("Informe a planilha Resultados YoY.");

const rows = await readSpreadsheetRows(inputPath);
const headerIndex = rows.findIndex((row) => String(row[2] ?? "").trim() === "NOME_REDE");
if (headerIndex < 0)
  throw new Error("Cabeçalho NOME_REDE não encontrado na planilha Resultados YoY.");

const header = rows[headerIndex] ?? [];
const isMetaHeader = (value) => {
  const normalized = normalizeHeader(value).toLowerCase();
  return normalized === "meta" || /^meta20\d{2}$/.test(normalized);
};
const isRealHeader = (value) => {
  const normalized = normalizeHeader(value).toLowerCase();
  return normalized === "real" || /^real20\d{2}$/.test(normalized);
};
const metaColumns = header
  .map((value, index) => (isMetaHeader(value) && isRealHeader(header[index + 1]) ? index : -1))
  .filter((index) => index > 2);
const meta = metaColumns[0] ?? 4;
const previousMeta = metaColumns[1] ?? meta + 7;
const columns = {
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

let currentProduct = "";
const records = rows.slice(headerIndex + 1).flatMap((row) => {
  const product = String(row[0] ?? "").trim();
  if (product) currentProduct = product;
  const company = String(row[2] ?? "").trim();
  if (!currentProduct || !company) return [];
  return [
    {
      company,
      product: currentProduct.replace(/_\s*PV$/i, "").trim(),
      meta: parseNumber(row[columns.meta]),
      real: parseNumber(row[columns.real]),
      attainment: parseNumber(row[columns.attainment]),
      gap: parseNumber(row[columns.gap]),
      average: parseNumber(row[columns.average]),
      previousMeta: parseNumber(row[columns.previousMeta]),
      previousReal: parseNumber(row[columns.previousReal]),
      previousAttainment: parseNumber(row[columns.previousAttainment]),
      previousGap: parseNumber(row[columns.previousGap]),
      previousAverage: parseNumber(row[columns.previousAverage]),
      yoy: parseNumber(row[columns.yoy]),
      yoyGap: parseNumber(row[columns.yoyGap]),
    },
  ];
});
if (!records.length) throw new Error("Não foram encontrados resultados por empresa na planilha.");
const snapshot = {
  source: {
    report: path.basename(inputPath),
    companyColumn: "NOME_REDE",
    period: "YTD 2026",
    monthsElapsed: 6,
    previousPeriod: "YTD 2025",
    importedAt: new Date().toISOString(),
  },
  records,
};
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, records: records.length }));
