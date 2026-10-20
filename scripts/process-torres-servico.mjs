import fs from "node:fs/promises";
import path from "node:path";
import { readSpreadsheetRows } from "./spreadsheet-reader.mjs";

import { buildServiceTowers } from "./service-towers.mjs";

const inputPath = process.argv[2];
const outputPath = path.resolve(process.argv[3] ?? ".data/snapshots/torres-servico.snapshot.json");
if (!inputPath) throw new Error("Informe a planilha de Torres de serviço.");

const rows = await readSpreadsheetRows(inputPath);
const towers = buildServiceTowers(rows);

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
console.log(
  JSON.stringify({
    outputPath,
    towers: towers.length,
    rows: towers.reduce((sum, tower) => sum + tower.rows.length, 0),
  }),
);
