import fs from "node:fs/promises";
import path from "node:path";
import { parseNumber, readSpreadsheetRows } from "./spreadsheet-reader.mjs";

const inputPath = process.argv[2];
const outputPath = path.resolve(process.argv[3] ?? ".data/snapshots/resultados-yoy.snapshot.json");
if (!inputPath) throw new Error("Informe a planilha Resultados YoY.");

const rows = await readSpreadsheetRows(inputPath);
const headerIndex = rows.findIndex((row) => String(row[2] ?? "").trim() === "NOME_REDE");
if (headerIndex < 0) throw new Error("Cabeçalho NOME_REDE não encontrado na planilha Resultados YoY.");

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
      meta: parseNumber(row[6]),
      real: parseNumber(row[7]),
      previousMeta: parseNumber(row[13]),
      previousReal: parseNumber(row[14]),
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
