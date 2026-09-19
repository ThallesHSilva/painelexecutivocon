import fs from "node:fs/promises";
import path from "node:path";
import { readSpreadsheetSheets } from "./spreadsheet-reader.mjs";
import { buildQuartilSnapshot } from "./quartil.mjs";

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("Informe arquivo Quartil e destino.");
const snapshot = buildQuartilSnapshot(await readSpreadsheetSheets(input), path.basename(input));
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify(snapshot));
console.log(
  JSON.stringify({
    consultants: snapshot.consultants.length,
    months: snapshot.months,
    warnings: snapshot.warnings.length,
  }),
);
