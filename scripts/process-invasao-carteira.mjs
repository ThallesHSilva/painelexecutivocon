import fs from "node:fs/promises";
import path from "node:path";
import { readSpreadsheetRows } from "./spreadsheet-reader.mjs";
import { buildInvasaoSnapshot, mergeInvasaoSnapshots } from "./invasao-carteira.mjs";

const [input, output, previousPath] = process.argv.slice(2);
if (!input || !output) throw new Error("Informe a base de invasão de carteira e o destino.");

let snapshot = buildInvasaoSnapshot(await readSpreadsheetRows(input), path.basename(input));
if (previousPath) {
  const previous = await fs
    .readFile(previousPath, "utf8")
    .then((text) => JSON.parse(text))
    .catch(() => null);
  snapshot = mergeInvasaoSnapshots(previous, snapshot);
}
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, JSON.stringify(snapshot));
console.log(
  JSON.stringify({
    partners: snapshot.partners.length,
    months: snapshot.months,
    records: snapshot.records.length,
  }),
);
