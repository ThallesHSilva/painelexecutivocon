import fs from "node:fs/promises";
import path from "node:path";
import { normalizeHeader, parseNumber, readSpreadsheetRows } from "./spreadsheet-reader.mjs";

const inputPath = process.argv[2];
const outputPath = path.resolve(
  process.argv[3] ?? ".data/snapshots/analitico-portabilidade.snapshot.json",
);
if (!inputPath) throw new Error("Informe a planilha de Portabilidade analítica.");

const rows = await readSpreadsheetRows(inputPath);
const headerIndex = rows.findIndex((row) => {
  const headers = row.map(normalizeHeader);
  return headers.includes("GRUPOECONOMICO") && headers.includes("ANOMESAGENDAMENTO");
});
if (headerIndex < 0) throw new Error("Cabeçalhos de Portabilidade analítica não encontrados.");
const headers = rows[headerIndex].map(normalizeHeader);
const indexOf = (name) => headers.indexOf(name);
const required = [
  "GRUPOECONOMICO",
  "ANOMESAGENDAMENTO",
  "TIPOPORTABILIDADE",
  "OPERADORA",
  "PORTINFM",
  "PORTOUTFM",
];
if (required.some((name) => indexOf(name) < 0))
  throw new Error("Colunas obrigatórias de Portabilidade analítica ausentes.");
const at = (row, header) => row[indexOf(header)] ?? "";
const records = rows.slice(headerIndex + 1).flatMap((row) => {
  const company = String(at(row, "GRUPOECONOMICO")).trim();
  const month = Number(at(row, "ANOMESAGENDAMENTO"));
  const operator = String(at(row, "OPERADORA")).trim();
  const type = String(at(row, "TIPOPORTABILIDADE")).trim();
  if (!company || !operator || !type || !Number.isInteger(month)) return [];
  return [
    {
      company,
      month,
      operator,
      portIn: parseNumber(at(row, "PORTINFM")),
      portOut: parseNumber(at(row, "PORTOUTFM")),
    },
  ];
});
const snapshot = {
  source: {
    report: path.basename(inputPath),
    companyColumn: "Grupo Economico",
    monthColumn: "ANOMES_AGENDAMENTO",
    typeColumn: "TIPO_PORTABILIDADE",
    operatorColumn: "OPERADORA",
    portInColumn: "PortIn_FM",
    portOutColumn: "PortOut_FM",
    importedAt: new Date().toISOString(),
  },
  records,
};
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, records: records.length }));
