import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { TextDecoder } from "node:util";

const inputPath = process.argv[2] ?? process.env.MAPA_PARQUE_PATH;
const outputPath = path.resolve(process.argv[3] ?? ".data/snapshots/mapa-parque.snapshot.json");

if (!inputPath) {
  throw new Error(
    'Informe o CSV: node scripts/process-mapa-parque-all.mjs "C:\\caminho\\MAPA PARQUE.csv"',
  );
}

function decode(buffer) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

function* parseDelimited(source, delimiter = ";") {
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else quoted = false;
      } else field += character;
    } else if (character === '"' && field.length === 0) quoted = true;
    else if (character === delimiter) {
      row.push(field);
      field = "";
    } else if (character === "\r" || character === "\n") {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      yield row;
      row = [];
      field = "";
    } else field += character;
  }
  if (field.length || row.length) {
    row.push(field);
    yield row;
  }
}

function normalize(value) {
  return String(value ?? "").trim();
}

function normalizedKey(value) {
  return normalize(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function displayPartnerName(key, sourceName) {
  if (key === "a7connect") return "A7 Connect";
  return sourceName;
}

function sumObjects(objects) {
  const result = {};
  for (const object of objects) {
    for (const [key, value] of Object.entries(object ?? {})) {
      if (typeof value === "number") result[key] = (result[key] ?? 0) + value;
      else if (typeof value === "boolean") result[key] = Boolean(result[key]) || value;
      else if (!(key in result)) result[key] = value;
    }
  }
  return result;
}

function mergeRows(scopes, field, valueFields) {
  const rows = new Map();
  for (const scope of scopes) {
    for (const item of field(scope)) {
      const key = item.tipo ?? item.categoria ?? item.cidade ?? item.label;
      const current = rows.get(key) ?? { ...item };
      for (const valueField of valueFields) {
        current[valueField] = (rows.has(key) ? current[valueField] : 0) + (item[valueField] ?? 0);
      }
      rows.set(key, current);
    }
  }
  return [...rows.values()];
}

const raw = await fs.readFile(inputPath);
const parsedRows = parseDelimited(decode(raw).replaceAll("\u0000", ""));
const header = parsedRows.next();
if (header.done) throw new Error("O CSV está vazio.");
const headers = header.value.map((value) => normalize(value).replace(/^\uFEFF/, ""));
const partnerIndex = headers.indexOf("NOMEREDE");
if (partnerIndex < 0) throw new Error("Cabeçalho NOMEREDE ausente no Mapa Parque.");

const partnerNames = new Map();
for (const row of parsedRows) {
  if (row.length !== headers.length) continue;
  const name = normalize(row[partnerIndex]);
  const key = normalizedKey(name);
  if (!key) continue;
  const current = partnerNames.get(key) ?? { name, rows: 0 };
  current.rows += 1;
  partnerNames.set(key, current);
}
const validPartners = [...partnerNames.entries()].filter(([, partner]) => partner.rows >= 10);
if (!validPartners.length) throw new Error("Nenhum parceiro válido preenchido na coluna NOMEREDE.");

const temporaryDirectory = await fs.mkdtemp(path.join(path.dirname(outputPath), ".mapa-import-"));
const processorPath = path.resolve("scripts/process-mapa-parque.mjs");
const snapshots = [];

try {
  for (const [key, partner] of validPartners) {
    const name = displayPartnerName(key, partner.name);
    const partnerOutput = path.join(temporaryDirectory, `${key}.json`);
    execFileSync(
      process.execPath,
      [processorPath, path.resolve(inputPath), name, partnerOutput, "--filter-partner"],
      { stdio: "pipe", maxBuffer: 10 * 1024 * 1024 },
    );
    snapshots.push(JSON.parse(await fs.readFile(partnerOutput, "utf8")));
  }
} finally {
  await fs.rm(temporaryDirectory, { recursive: true, force: true });
}

const totals = sumObjects(snapshots.map((item) => item.totals));
const opportunities = sumObjects(snapshots.map((item) => item.opportunities));
opportunities.percentageWithOpportunity = totals.allCnpj
  ? opportunities.uniqueCnpjWithOpportunity / totals.allCnpj
  : 0;
const ftth = sumObjects(snapshots.map((item) => item.breakdowns.ftth));
ftth.penetracaoBase =
  ftth.baseBasica + ftth.oportunidades
    ? ftth.baseBasica / (ftth.baseBasica + ftth.oportunidades)
    : 0;
ftth.composicao = mergeRows(snapshots, (item) => item.breakdowns.ftth.composicao, ["valor"]);
ftth.oportunidadesPorCidade = mergeRows(
  snapshots,
  (item) => item.breakdowns.ftth.oportunidadesPorCidade,
  ["oportunidades"],
).sort((left, right) => right.oportunidades - left.oportunidades);

const aggregateSnapshot = {
  schemaVersion: 2,
  source: {
    ...snapshots[0].source,
    fileName: path.basename(inputPath),
    fileSizeBytes: raw.length,
    importedAt: new Date().toISOString(),
    sourceModifiedAt: (await fs.stat(inputPath)).mtime.toISOString(),
  },
  rules: snapshots[0].rules,
  partners: snapshots.map((item) => item.partners[0]),
  scopes: Object.fromEntries(
    snapshots.map((item) => [
      item.partners[0].id,
      {
        totals: item.totals,
        opportunities: item.opportunities,
        breakdowns: item.breakdowns,
        quality: item.quality,
      },
    ]),
  ),
  totals,
  opportunities,
  breakdowns: {
    byType: mergeRows(snapshots, (item) => item.breakdowns.byType, ["valor"]),
    byCategory: mergeRows(snapshots, (item) => item.breakdowns.byCategory, ["valor"]).sort(
      (left, right) => right.valor - left.valor,
    ),
    byCity: mergeRows(snapshots, (item) => item.breakdowns.byCity, ["records", "opportunities"])
      .sort((left, right) => right.opportunities - left.opportunities)
      .slice(0, 12),
    mobileComposition: mergeRows(snapshots, (item) => item.breakdowns.mobileComposition, ["valor"]),
    ftth,
    digitalComposition: mergeRows(snapshots, (item) => item.breakdowns.digitalComposition, [
      "valor",
    ]),
    status: mergeRows(snapshots, (item) => item.breakdowns.status, ["value"]),
    mei: mergeRows(snapshots, (item) => item.breakdowns.mei, ["value"]),
  },
  quality: sumObjects(snapshots.map((item) => item.quality)),
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(aggregateSnapshot, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    {
      outputPath,
      partners: aggregateSnapshot.partners,
      rawRecords: totals.rawRecords,
      uniqueCnpj: totals.uniqueCnpj,
    },
    null,
    2,
  ),
);
