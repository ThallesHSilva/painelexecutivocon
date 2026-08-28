import fs from "node:fs/promises";
import path from "node:path";
import { normalizeHeader, parseNumber, readSpreadsheetRows } from "./spreadsheet-reader.mjs";

const inputPath = process.argv[2];
const outputPath = path.resolve(process.argv[3] ?? ".data/snapshots/best-guess.snapshot.json");
if (!inputPath) throw new Error("Informe a planilha Best Guess.");

const rows = await readSpreadsheetRows(inputPath);
const headerIndex = rows.findIndex((row) => {
  const headers = row.map(normalizeHeader);
  return headers.includes("PARCEIRO") && headers.includes("M0MTDPORTIN");
});
if (headerIndex < 0) throw new Error("Cabeçalhos de Best Guess não encontrados.");
const headers = rows[headerIndex].map(normalizeHeader);
const indexOf = (name) => headers.indexOf(name);
const required = ["PARCEIRO", "M0MTDPORTIN", "M0MTDPORTOUT", "BGFMPORTIN", "BGFMPORTOUT"];
if (required.some((name) => indexOf(name) < 0))
  throw new Error("Colunas obrigatórias de Best Guess ausentes.");
const divisionIndex = indexOf("NMDIVISAO");
const valueAt = (row, header) => row[indexOf(header)] ?? "";
const records = rows.slice(headerIndex + 1).flatMap((row) => {
  const company = String(valueAt(row, "PARCEIRO")).trim();
  const division = divisionIndex >= 0 ? String(row[divisionIndex] ?? "").trim() : "CON";
  if (!company || (divisionIndex >= 0 && normalizeHeader(division) !== "CON")) return [];
  const portIn = parseNumber(valueAt(row, "M0MTDPORTIN"));
  const portOut = parseNumber(valueAt(row, "M0MTDPORTOUT"));
  const bgIn = parseNumber(valueAt(row, "BGFMPORTIN"));
  const bgOut = parseNumber(valueAt(row, "BGFMPORTOUT"));
  return [
    {
      company,
      division,
      m0MtdPortIn: portIn,
      m0MtdPortOut: portOut,
      m0MtdSaldo: portIn + portOut,
      bgFmPortIn: bgIn,
      bgFmPortOut: bgOut,
      bgFmSaldo: bgIn + bgOut,
    },
  ];
});
const total = records.reduce(
  (current, row) =>
    Object.fromEntries(Object.entries(current).map(([key, value]) => [key, value + row[key]])),
  { m0MtdPortIn: 0, m0MtdPortOut: 0, m0MtdSaldo: 0, bgFmPortIn: 0, bgFmPortOut: 0, bgFmSaldo: 0 },
);
const snapshot = {
  source: {
    report: path.basename(inputPath),
    companyColumn: "PARCEIRO",
    divisionColumn: "NM_DIVISAO",
    division: "CON",
    period: new Date().toISOString().slice(0, 7).replace("-", ""),
    importedAt: new Date().toISOString(),
  },
  records,
  total,
};
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, records: records.length }));
