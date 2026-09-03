import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { TextDecoder } from "node:util";
import { calculateQscSnapshot } from "./qsc-metrics.mjs";

const requestedInputs = process.argv.slice(2);
if (!requestedInputs.length) {
  throw new Error(
    'Informe ao menos um CSV QSC: node scripts/process-qsc.mjs "carteira:QSC_CARTEIRA.csv"',
  );
}
const inputs = requestedInputs.map((input) => {
  const match = input.match(/^(carteira|fixa|movel):(.*)$/i);
  if (!match || !match[2]) {
    throw new Error("Use o formato dominio:caminho para cada arquivo QSC.");
  }
  return { domain: match[1].toLowerCase(), filePath: match[2] };
});

const outputPath = path.resolve(
  process.env.QSC_SNAPSHOT_PATH ?? ".data/snapshots/qsc.snapshot.json",
);
const mapaSnapshotPath = path.resolve(
  process.env.MAPA_PARQUE_SNAPSHOT_PATH ?? ".data/snapshots/mapa-parque.snapshot.json",
);

function normalize(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim();
}

function normalizeKey(value) {
  return normalize(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleUpperCase("pt-BR")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

function compactKey(value) {
  return normalizeKey(value).replaceAll(" ", "");
}

function slugify(value) {
  return normalize(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseNumber(value) {
  const raw = normalize(value);
  if (!raw) return 0;
  const canonical = raw.includes(",") ? raw.replaceAll(".", "").replace(",", ".") : raw;
  const parsed = Number(canonical);
  return Number.isFinite(parsed) ? parsed : 0;
}

function quantityFromObservation(value) {
  const match = normalize(value).match(/quantidade\s+contas?\s+em\s+dauto\s*:\s*([\d.,-]+)/i);
  return match ? parseNumber(match[1]) : 0;
}

async function detectEncoding(filePath) {
  const handle = await fs.open(filePath, "r");
  try {
    const buffer = Buffer.alloc(65_536);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(0, bytesRead));
    return "utf-8";
  } catch {
    return "windows-1252";
  } finally {
    await handle.close();
  }
}

async function* decodedChunks(filePath, encoding) {
  const decoder = new TextDecoder(encoding);
  for await (const chunk of createReadStream(filePath)) {
    yield decoder.decode(chunk, { stream: true });
  }
  const tail = decoder.decode();
  if (tail) yield tail;
}

async function* parseDelimited(filePath, encoding, delimiter = ";") {
  let row = [];
  let field = "";
  let quoted = false;
  let pendingQuote = false;
  let skipLf = false;

  for await (const chunk of decodedChunks(filePath, encoding)) {
    for (let index = 0; index < chunk.length; index += 1) {
      const char = chunk[index];

      if (skipLf) {
        skipLf = false;
        if (char === "\n") continue;
      }

      if (pendingQuote) {
        pendingQuote = false;
        if (char === '"') {
          field += '"';
          continue;
        }
        quoted = false;
      }

      if (quoted) {
        if (char === '"') {
          if (index + 1 < chunk.length) {
            if (chunk[index + 1] === '"') {
              field += '"';
              index += 1;
            } else {
              quoted = false;
            }
          } else {
            pendingQuote = true;
          }
        } else {
          field += char;
        }
        continue;
      }

      if (char === '"' && field.length === 0) {
        quoted = true;
      } else if (char === delimiter) {
        row.push(field);
        field = "";
      } else if (char === "\r" || char === "\n") {
        row.push(field);
        yield row;
        row = [];
        field = "";
        skipLf = char === "\r";
      } else {
        field += char;
      }
    }
  }

  if (pendingQuote) quoted = false;
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    yield row;
  }
}

function createAccumulator(base) {
  return { ...base, quantity: 0, rows: 0 };
}

function addToAccumulator(map, key, base, quantity) {
  const current = map.get(key) ?? createAccumulator(base);
  current.quantity += quantity;
  current.rows += 1;
  map.set(key, current);
}

function serializeAccumulator(value) {
  return value;
}

let mapaPartners = [];
try {
  const mapaSnapshot = JSON.parse(await fs.readFile(mapaSnapshotPath, "utf8"));
  mapaPartners = Array.isArray(mapaSnapshot.partners) ? mapaSnapshot.partners : [];
} catch {
  mapaPartners = [];
}

function resolvePartnerId(name, document) {
  const nameKey = compactKey(name);
  const match = mapaPartners.find((partner) => compactKey(partner.name) === nameKey);
  return match?.id ?? slugify(name || document || "parceiro");
}

const movementGroups = new Map();
const detailGroups = new Map();
const partners = new Map();
const source = [];
const competencies = new Set();

for (const { domain, filePath } of inputs) {
  const absolutePath = path.resolve(filePath);
  const stats = await fs.stat(absolutePath);
  const encoding = await detectEncoding(absolutePath);
  const rows = parseDelimited(absolutePath, encoding);
  const headerResult = await rows.next();
  if (headerResult.done) throw new Error(`${path.basename(absolutePath)} está vazio.`);

  const headers = headerResult.value.map(normalize);
  const indexByHeader = new Map(headers.map((header, index) => [normalizeKey(header), index]));
  const required = [
    "INDICADOR",
    "SUB INDICADOR",
    "COMPETENCIA",
    "GRUPO REDE TERMO",
    "TIPO MOVIMENTO",
    "QUANTIDADE",
  ];
  const missing = required.filter((header) => !indexByHeader.has(header));
  if (missing.length) {
    throw new Error(`${path.basename(absolutePath)} não possui: ${missing.join(", ")}`);
  }

  const valueAt = (row, header) => normalize(row[indexByHeader.get(normalizeKey(header))]);
  let rowCount = 0;

  for await (const row of rows) {
    if (row.length === 1 && !normalize(row[0])) continue;
    rowCount += 1;

    const indicator = valueAt(row, "INDICADOR");
    const subIndicator = valueAt(row, "SUB INDICADOR");
    const competence = valueAt(row, "COMPETENCIA");
    const partnerName = valueAt(row, "GRUPO REDE TERMO") || "Parceiro não informado";
    const partnerDocument = valueAt(row, "CNPJ PARCEIRO");
    const partnerId = resolvePartnerId(partnerName, partnerDocument);
    const movement = valueAt(row, "TIPO MOVIMENTO") || "Em branco";
    const movementDetail = valueAt(row, "DETALHE TIPO MOVIMENTO") || "Em branco";
    const reportedQuantity = parseNumber(valueAt(row, "QUANTIDADE"));
    const quantity =
      reportedQuantity ||
      (compactKey(subIndicator) === "PARQUECOMDEBITOAUTOMATICO"
        ? quantityFromObservation(valueAt(row, "OBSERVACAO"))
        : 0);

    partners.set(partnerId, { id: partnerId, name: partnerName, document: partnerDocument });
    if (competence) competencies.add(competence);

    const base = {
      domain,
      indicator,
      subIndicator,
      competence,
      partnerId,
      partnerName,
      movement,
    };
    const movementKey = [
      domain,
      indicator,
      subIndicator,
      competence,
      partnerId,
      normalizeKey(movement),
    ].join("\u001f");
    addToAccumulator(movementGroups, movementKey, base, quantity);

    const detailKey = `${movementKey}\u001f${normalizeKey(movementDetail)}`;
    addToAccumulator(detailGroups, detailKey, { ...base, movementDetail }, quantity);
  }

  source.push({
    domain,
    fileName: path.basename(absolutePath),
    fileSizeBytes: stats.size,
    encoding,
    delimiter: ";",
    sourceModifiedAt: stats.mtime.toISOString(),
    rows: rowCount,
  });
}

const sortRecords = (a, b) =>
  a.competence.localeCompare(b.competence) ||
  a.partnerName.localeCompare(b.partnerName, "pt-BR") ||
  a.subIndicator.localeCompare(b.subIndicator, "pt-BR") ||
  a.movement.localeCompare(b.movement, "pt-BR");

const sortedCompetencies = [...competencies].sort();
const sortedPartners = [...partners.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
const movementRecords = [...movementGroups.values()].map(serializeAccumulator).sort(sortRecords);
const detailRecords = [...detailGroups.values()].map(serializeAccumulator).sort(sortRecords);
const calculated = calculateQscSnapshot({
  movements: movementRecords,
  details: detailRecords,
  partners: sortedPartners,
  competencies: sortedCompetencies,
});

const snapshot = {
  schemaVersion: 3,
  importedAt: new Date().toISOString(),
  updateFrequency: "semanal",
  source,
  competencies: sortedCompetencies,
  partners: sortedPartners,
  metricCount: calculated.metricCount,
  scopes: calculated.scopes,
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

const catalog = movementRecords.reduce((result, record) => {
  const key = `${record.domain} | ${record.subIndicator}`;
  const current = result.get(key) ?? new Set();
  current.add(record.movement);
  result.set(key, current);
  return result;
}, new Map());

console.log(
  JSON.stringify(
    {
      outputPath,
      source,
      partners: snapshot.partners,
      competencies: snapshot.competencies,
      catalog: [...catalog.entries()].map(([key, values]) => ({
        key,
        movements: [...values].sort(),
      })),
    },
    null,
    2,
  ),
);
