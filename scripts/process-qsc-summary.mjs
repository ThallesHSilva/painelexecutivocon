import fs from "node:fs/promises";
import path from "node:path";
import { readSpreadsheetRows, normalizeHeader } from "./spreadsheet-reader.mjs";
import { QSC_METRIC_DEFINITIONS, scoreMetric } from "./qsc-metrics.mjs";

const definitionsById = new Map(
  QSC_METRIC_DEFINITIONS.map((definition) => [definition.id, definition]),
);

const RESULT_IDS = {
  carteira: new Map([
    ["CHURNMOVEL", "churn-movel"],
    ["PQFIDELIZADO", "fidelizacao-movel"],
    ["CHURNBL", "churn-bl"],
    ["INVASAOCARTEIRA", "invasao-carteira"],
    ["CAR", "car"],
    ["PARQUECOMDAUTO", "debito-automatico"],
    ["APROVEITAMENTODACARTEIRA", "aproveitamento-carteira"],
    ["B2PARQUEBIOMETRADO", "biometria"],
  ]),
  fixa: new Map([
    ["CANCELAMENTOCOMERCIAL", "cancelamento-comercial"],
    ["REALTA", "re-alta-fixa"],
    ["EARLYCHURN", "early-churn-fixa"],
    ["DEBITOAUTOMATICO", "debito-automatico-fixa"],
    ["TOTALIZACAODASALTAS", "totalizacao-fixa"],
    ["DIGITALIZACAODASALTAS", "digitalizacao-fixa"],
    ["QUALIDADEACEITE", "aceite-digital"],
    ["TFPBL", "tfp-fixa"],
  ]),
  movel: new Map([
    ["ECSCORE", "early-churn-movel"],
    ["PORTABILIDADESCORE", "saldo-portabilidade"],
    ["TOTALIZACAOSCORE", "totalizacao-movel"],
    ["DIGITALIZACAOSCORE", "digitalizacao-movel"],
    ["TFPMOVEL", "tfp-movel"],
  ]),
};

function text(value) {
  return String(value ?? "").trim();
}

function parseNumeric(value, field, required = true) {
  const source = text(value);
  if (!source) {
    if (required) throw new Error(`Campo ${field} vazio na base QSC.`);
    return null;
  }
  const normalized = source.replace(/%$/, "").includes(",")
    ? source.replace(/%$/, "").replaceAll(".", "").replace(",", ".")
    : source.replace(/%$/, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`Campo ${field} inválido: ${source}.`);
  return parsed;
}

function parsePercent(value) {
  const source = text(value);
  if (!source) return null;
  const parsed = parseNumeric(source, "%");
  return source.endsWith("%") || Math.abs(parsed) > 1 ? parsed / 100 : parsed;
}

function filterValue(lines, key) {
  const normalizedKey = normalizeHeader(key);
  for (const line of lines) {
    const normalizedLine = line
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .trim();
    const match = normalizedLine.match(/^(.+?)\s+e\s+(.+)$/i);
    if (match && normalizeHeader(match[1]) === normalizedKey) return match[2].trim();
  }
  return null;
}

function filterBlock(rows) {
  const cell = rows
    .flat()
    .map(text)
    .find((value) => /filtros aplicados\s*:/i.test(value));
  if (!cell) throw new Error("A base QSC não contém o bloco 'Filtros aplicados:'.");
  return cell
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function domainForType(value) {
  const type = normalizeHeader(value);
  if (type === "MOVEL") return "movel";
  if (type === "CARTEIRA") return "carteira";
  if (type === "BANDALARGA" || type === "FIXA") return "fixa";
  throw new Error(`TIPO_QSC não suportado: ${value}.`);
}

function competenceFor(value) {
  const source = text(value);
  if (!/^\d{6}$/.test(source)) throw new Error(`anomestxt inválido: ${source}.`);
  return `${source.slice(0, 4)}-${source.slice(4)}`;
}

function metricId(domain, result) {
  const normalized = normalizeHeader(result);
  return RESULT_IDS[domain].get(normalized) ?? `${domain}-${normalized.toLocaleLowerCase("pt-BR")}`;
}

function columnIndex(headers, matcher) {
  const index = headers.findIndex(matcher);
  if (index < 0)
    throw new Error(
      `Coluna obrigatória não encontrada na base QSC: ${matcher.name || "desconhecida"}.`,
    );
  return index;
}

export function parseQscSummaryRows(rows, sourceName = "") {
  const filters = filterBlock(rows);
  const qscType = filterValue(filters, "TIPO_QSC");
  const partnerName = filterValue(filters, "GRUPO_REDE_TERMO");
  const sourceCompetence = filterValue(filters, "anomestxt");
  if (!qscType || !partnerName || !sourceCompetence) {
    throw new Error("A base QSC precisa informar TIPO_QSC, GRUPO_REDE_TERMO e anomestxt.");
  }

  const domain = domainForType(qscType);
  const competence = competenceFor(sourceCompetence);
  const headerIndex = rows.findIndex((row) => {
    const headers = row.map(normalizeHeader);
    return headers.includes("RESULTADO") && headers.includes("KPI1") && headers.includes("KPI2");
  });
  if (headerIndex < 0) throw new Error("Cabeçalho de resumo QSC não encontrado.");

  const headers = rows[headerIndex].map(normalizeHeader);
  const rawHeaders = rows[headerIndex].map(text);
  const resultColumn = headers.indexOf("RESULTADO");
  const kpi1Column = headers.indexOf("KPI1");
  const kpi2Column = headers.indexOf("KPI2");
  const percentColumn =
    rawHeaders.findIndex((value) => value === "%") >= 0
      ? rawHeaders.findIndex((value) => value === "%")
      : headers.indexOf("PERCENTUAL");
  const noteColumn = headers.indexOf("NOTA");
  const bandColumn = headers.indexOf("FAIXARESUMO");
  if (percentColumn < 0 || noteColumn < 0 || bandColumn < 0) {
    throw new Error("A base QSC precisa conter %, Nota e Faixa_resumo.");
  }

  const records = [];
  let summary = null;
  for (const row of rows.slice(headerIndex + 1)) {
    const result = text(row[resultColumn]);
    if (!result) continue;
    if (normalizeHeader(result) === "TOTAL") {
      summary = {
        kpi1: parseNumeric(row[kpi1Column], "KPI 1"),
        kpi2: parseNumeric(row[kpi2Column], "KPI 2"),
        percent: parsePercent(row[percentColumn]),
        note: parseNumeric(row[noteColumn], "Nota", false),
        band: text(row[bandColumn]) || null,
      };
      continue;
    }
    const id = metricId(domain, result);
    if (records.some((record) => record.id === id)) {
      throw new Error(`Indicador duplicado na base QSC: ${result}.`);
    }
    records.push({
      id,
      domain,
      result,
      competence,
      partnerName,
      kpi1: parseNumeric(row[kpi1Column], "KPI 1"),
      kpi2: parseNumeric(row[kpi2Column], "KPI 2"),
      percent: parsePercent(row[percentColumn]),
      note: parseNumeric(row[noteColumn], "Nota", false),
      band: text(row[bandColumn]) || null,
    });
  }
  if (!records.length) throw new Error("A base QSC não contém indicadores.");

  return {
    sourceName: path.basename(sourceName),
    qscType,
    domain,
    partnerName,
    sourceCompetence,
    competence,
    filters,
    records,
    summary,
  };
}

export async function readQscSummary(filePath) {
  return parseQscSummaryRows(await readSpreadsheetRows(filePath), filePath);
}

function partnerSlug(value) {
  return text(value)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function readCanonicalPartners() {
  const snapshotPath = process.env.MAPA_PARQUE_SNAPSHOT_PATH;
  if (!snapshotPath) return [];
  try {
    const snapshot = JSON.parse(await fs.readFile(snapshotPath, "utf8"));
    return Array.isArray(snapshot.partners) ? snapshot.partners : [];
  } catch {
    return [];
  }
}

function resolvePartner(partnerName, canonicalPartners) {
  const key = normalizeHeader(partnerName);
  const match = canonicalPartners.find((partner) => normalizeHeader(partner.name) === key);
  return {
    id: text(match?.id) || partnerSlug(partnerName) || "parceiro-nao-informado",
    name: text(match?.name) || partnerName,
  };
}

function definitionFor(record) {
  const definition = definitionsById.get(record.id);
  return {
    label: definition?.label || record.result.replace(/^%\s*/, ""),
    favorableDirection: definition?.favorableDirection || "up",
    scoreRules: definition?.scoreRules || [],
  };
}

function pointFor(record) {
  const definition = definitionFor(record);
  return {
    competence: record.competence,
    value: record.percent,
    numerator: record.kpi1,
    denominator: record.kpi2,
    available: true,
    zeroPark: record.kpi1 === 0 && record.kpi2 === 0,
    score: record.note,
    scoreBand: record.band,
  };
}

function metricFor(record) {
  const definition = definitionFor(record);
  return {
    id: record.id,
    domain: record.domain,
    label: definition.label,
    formula: "Valores KPI 1, KPI 2 e percentual informados pela base QSC.",
    interpretation: `Nota e faixa informadas em ${record.result}.`,
    favorableDirection: definition.favorableDirection,
    scoreRules: definition.scoreRules,
    latest: pointFor(record),
  };
}

export function aggregateRecords(records) {
  const groups = new Map();
  for (const record of records) {
    const key = `${record.id}\u001f${record.competence}`;
    const current = groups.get(key) || {
      ...record,
      kpi1: 0,
      kpi2: 0,
      note: 0,
      recordCount: 0,
    };
    current.kpi1 += record.kpi1;
    current.kpi2 += record.kpi2;
    current.recordCount += 1;
    if (record.note !== null) current.note += record.note;
    current.band = current.recordCount === 1 ? record.band : null;
    current.sourcePercent = current.recordCount === 1 ? record.percent : null;
    current.percent = current.kpi2 > 0 ? current.kpi1 / current.kpi2 : null;
    groups.set(key, current);
  }
  return [...groups.values()].map((record) => {
    const isSingleSource = record.recordCount === 1;
    const { recordCount, sourcePercent, ...cleanRecord } = record;
    const percent = isSingleSource ? sourcePercent : cleanRecord.percent;
    const consolidatedScore = isSingleSource
      ? { score: cleanRecord.note, scoreBand: cleanRecord.band }
      : scoreMetric(percent, definitionFor(cleanRecord).scoreRules);
    return {
      ...cleanRecord,
      percent,
      note: consolidatedScore.score,
      band: consolidatedScore.scoreBand,
    };
  });
}

export async function buildQscSummarySnapshot(filePaths) {
  const parsed = await Promise.all(filePaths.map(readQscSummary));
  const canonicalPartners = await readCanonicalPartners();
  const partners = new Map();
  const records = [];
  const source = [];

  for (const file of parsed) {
    const partner = resolvePartner(file.partnerName, canonicalPartners);
    partners.set(partner.id, partner);
    source.push({
      fileName: file.sourceName,
      domain: file.domain,
      qscType: file.qscType,
      partner: partner.name,
      competence: file.competence,
      filters: file.filters.join("\n"),
      indicators: file.records.length,
      totalKpi1: file.summary?.kpi1 ?? "",
      totalKpi2: file.summary?.kpi2 ?? "",
    });
    records.push(
      ...file.records.map((record) => ({
        ...record,
        partnerId: partner.id,
        partnerName: partner.name,
      })),
    );
  }

  const partnerList = [...partners.values()].sort((left, right) =>
    left.name.localeCompare(right.name, "pt-BR"),
  );
  const competencies = [...new Set(records.map((record) => record.competence))].sort();
  const scopeFor = (scopeId, name, scopeRecords) => ({
    id: scopeId,
    name,
    partnerIds: scopeId === "__all__" ? partnerList.map((partner) => partner.id) : [scopeId],
    rowsByCompetence: Object.fromEntries(
      competencies.map((competence) => [
        competence,
        scopeRecords.filter((record) => record.competence === competence).length,
      ]),
    ),
    metrics: scopeRecords.map(metricFor),
  });
  const scopes = [
    scopeFor("__all__", "Todos os parceiros", aggregateRecords(records)),
    ...partnerList.map((partner) =>
      scopeFor(
        partner.id,
        partner.name,
        records.filter((record) => record.partnerId === partner.id),
      ),
    ),
  ];

  return {
    schemaVersion: 4,
    importedAt: new Date().toISOString(),
    updateFrequency: "mensal",
    source,
    competencies,
    partners: partnerList,
    metricCount: new Set(records.map((record) => record.id)).size,
    scopes,
  };
}

const args = process.argv.slice(2);
if (args[0] === "--inspect") {
  const file = args[1];
  if (!file) throw new Error("Informe um arquivo XLSX para inspeção.");
  console.log(JSON.stringify(await readQscSummary(file), null, 2));
} else if (args[0] === "--output") {
  const outputPath = args[1];
  const files = args.slice(2);
  if (!outputPath || !files.length)
    throw new Error("Informe o destino e ao menos um arquivo XLSX.");
  const snapshot = await buildQscSummarySnapshot(files);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(
    JSON.stringify(
      {
        outputPath,
        files: snapshot.source,
        partners: snapshot.partners,
        competencies: snapshot.competencies,
      },
      null,
      2,
    ),
  );
}
