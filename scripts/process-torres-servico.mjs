import fs from "node:fs/promises";
import path from "node:path";
import { parseNumber, readSpreadsheetRows } from "./spreadsheet-reader.mjs";

const inputPath = process.argv[2];
const outputPath = path.resolve(process.argv[3] ?? ".data/snapshots/torres-servico.snapshot.json");
if (!inputPath) throw new Error("Informe a planilha de Torres de serviço.");

const rows = await readSpreadsheetRows(inputPath);
const titles = rows[1] ?? [];
const headers = rows[2] ?? [];
const definitions = [
  { id: "altas-movel", title: "Altas Móvel", start: 4, end: 16 },
  { id: "aparelhos", title: "Aparelhos", start: 32, end: 41 },
  { id: "banda-larga", title: "Banda Larga", start: 44, end: 53 },
  { id: "dados-avancados", title: "Dados Avançados", start: 56, end: 61 },
  { id: "vvn", title: "VVN", start: 64, end: 71 },
  { id: "voz", title: "Voz (SIP / 0800)", start: 74, end: 79 },
  { id: "ti-recorrente", title: "TI Recorrente", start: 101, end: 107 },
  { id: "vivo-tech", title: "Vivo Tech", start: 110, end: 115 },
];

function clean(value) {
  const text = String(value ?? "").trim();
  return text === "" || text.startsWith("#") ? null : text;
}

function value(value) {
  const text = clean(value);
  if (text == null) return null;
  const parsed = parseNumber(text);
  return Number.isFinite(parsed) && String(text).match(/[0-9]/) ? parsed : text;
}

const towers = definitions.map((definition) => {
  const end = definition.end;
  const hiddenColumns = new Set([
    ...(definition.id === "altas-movel" ? ["DEAL?", "BIG DEAL", "BRUTO", "46259"] : []),
    ...(definition.id !== "aparelhos" ? ["BRUTO"] : []),
  ]);
  const columns = Array.from({ length: end - definition.start - 1 }, (_, offset) => {
    const index = definition.start + offset + 1;
    const label = clean(headers[index]) ?? `Indicador ${offset + 1}`;
    return {
      key: `c${index}`,
      label,
      format: /%|X PC/i.test(label) ? "percent" : "number",
      index,
    };
  }).filter((column) => !hiddenColumns.has(column.label.toUpperCase()));
  const records = rows.slice(3, 22);
  const totalRecord = records.find((row) => clean(row[definition.start])?.toUpperCase() === "TT");
  const dataRows = records
    .filter((row) => {
      const partner = clean(row[definition.start]);
      return partner && partner.toUpperCase() !== "TT";
    })
    .map((row) => ({
      partner: clean(row[definition.start]),
      values: Object.fromEntries(columns.map((column) => [column.key, value(row[column.index])])),
    }));
  const fallbackTotal = Object.fromEntries(
    columns.map((column) => [
      column.key,
      dataRows.reduce((sum, row) => sum + (typeof row.values[column.key] === "number" ? row.values[column.key] : 0), 0),
    ]),
  );
  return {
    id: definition.id,
    title: definition.title,
    sourceTitle: clean(titles[definition.start]) ?? definition.title,
    columns: columns.map(({ index, ...column }) => column),
    rows: dataRows,
    total: totalRecord
      ? Object.fromEntries(columns.map((column) => [column.key, value(totalRecord[column.index])]))
      : fallbackTotal,
  };
});

if (!towers.some((tower) => tower.rows.length))
  throw new Error("Não foram encontradas linhas de parceiros nas Torres de serviço.");

const snapshot = {
  source: {
    report: path.basename(inputPath),
    importedAt: new Date().toISOString(),
    dataRange: "Bloco de parceiros",
  },
  towers,
};
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(JSON.stringify({ outputPath, towers: towers.length, rows: towers.reduce((sum, tower) => sum + tower.rows.length, 0) }));
