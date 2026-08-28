import fs from "node:fs/promises";
import path from "node:path";
import { TextDecoder } from "node:util";

const inputPath = process.argv[2] ?? process.env.MAPA_PARQUE_PATH;
const partnerName = process.argv[3] ?? "A7 Connect";
const outputPath = path.resolve(process.argv[4] ?? ".data/snapshots/mapa-parque.snapshot.json");
const partnerFilter = process.argv[5] === "--filter-partner";

if (!inputPath) {
  throw new Error(
    'Informe o CSV: node scripts/process-mapa-parque.mjs "C:\\caminho\\MAPA PARQUE.csv" "Nome do parceiro"',
  );
}

const windows1252SpecialBytes = new Map([
  ["€", 0x80],
  ["‚", 0x82],
  ["ƒ", 0x83],
  ["„", 0x84],
  ["…", 0x85],
  ["†", 0x86],
  ["‡", 0x87],
  ["ˆ", 0x88],
  ["‰", 0x89],
  ["Š", 0x8a],
  ["‹", 0x8b],
  ["Œ", 0x8c],
  ["Ž", 0x8e],
  ["‘", 0x91],
  ["’", 0x92],
  ["“", 0x93],
  ["”", 0x94],
  ["•", 0x95],
  ["–", 0x96],
  ["—", 0x97],
  ["˜", 0x98],
  ["™", 0x99],
  ["š", 0x9a],
  ["›", 0x9b],
  ["œ", 0x9c],
  ["ž", 0x9e],
  ["Ÿ", 0x9f],
]);

function decodeSource(buffer) {
  try {
    return {
      encoding: "utf-8",
      text: new TextDecoder("utf-8", { fatal: true }).decode(buffer),
    };
  } catch {
    return {
      encoding: "windows-1252",
      text: new TextDecoder("windows-1252").decode(buffer),
    };
  }
}

function repairMojibake(value) {
  const source = String(value ?? "");
  if (!/[ÃÂâ]/.test(source)) return source;

  const bytes = [];
  for (const char of source) {
    const specialByte = windows1252SpecialBytes.get(char);
    if (specialByte != null) {
      bytes.push(specialByte);
      continue;
    }
    const code = char.codePointAt(0);
    if (code == null || code > 0xff) return source;
    bytes.push(code);
  }

  const repaired = new TextDecoder("utf-8").decode(Uint8Array.from(bytes));
  return repaired.includes("\uFFFD") ? source : repaired;
}

function* parseDelimited(source, delimiter = ";") {
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
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
      if (char === "\r" && source[index + 1] === "\n") index += 1;
      row.push(field);
      yield row;
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    yield row;
  }
}

function normalize(value) {
  return repairMojibake(String(value ?? "").trim());
}

function normalizeUpper(value) {
  return normalize(value).toLocaleUpperCase("pt-BR");
}

function normalizePartnerKey(value) {
  return normalizeUpper(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

function parseNumber(value) {
  const normalized = normalize(value);
  if (!normalized) return 0;
  const canonical = normalized.includes(",")
    ? normalized.replaceAll(".", "").replace(",", ".")
    : normalized;
  const number = Number(canonical);
  return Number.isFinite(number) ? number : 0;
}

function parseDeviceCredit(value) {
  const match = normalize(value).match(/R\$\s*([\d.,]+)/i);
  return match ? parseNumber(match[1]) : 0;
}

function increment(map, value, amount = 1) {
  const label = normalize(value) || "Em branco";
  map.set(label, (map.get(label) ?? 0) + amount);
}

function mobileCategory(value) {
  const normalized = normalizeUpper(value);
  if (normalized.includes("WINBACK")) return "Winback";
  if (normalized.includes("RENOVAÇÃO")) return "Renovação";
  if (normalized.includes("AQUISIÇÃO")) return "Aquisição";
  return "Outras ofertas";
}

function orderedEntries(map, limit) {
  return [...map.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, "pt-BR"))
    .slice(0, limit);
}

function formatPartnerId(name) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const raw = await fs.readFile(inputPath);
const stats = await fs.stat(inputPath);
const decoded = decodeSource(raw);
const rows = parseDelimited(decoded.text.replaceAll("\u0000", ""));
const headerResult = rows.next();

if (headerResult.done) throw new Error("O CSV está vazio.");

const headers = headerResult.value.map((header) => normalize(header).replace(/^\uFEFF/, ""));
const indexByHeader = new Map(headers.map((header, index) => [header, index]));
const requiredHeaders = [
  "NR_CNPJ",
  "COD_CLIENTE",
  "SITUACAO_RECEITA",
  "FLG_MEI",
  "REC_MOVEL",
  "FLG_COBERTURA",
  "TP_PRODUTO",
  "FIXA_BASICA",
  "DIGITAL_1",
  "AVANCADOS",
  "VIVO_TECH",
  "QT_MOVEL_TERM",
];
const missingHeaders = requiredHeaders.filter((header) => !indexByHeader.has(header));

if (missingHeaders.length) {
  throw new Error(`Cabeçalhos obrigatórios ausentes: ${missingHeaders.join(", ")}`);
}

const valueAt = (row, header) => normalize(row[indexByHeader.get(header)]);
const contactHeaders = [
  "EMAIL_CONTATO_PRINCIPAL_SFA",
  "CELULAR_CONTATO_PRINCIPAL_SFA",
  "TLFN_1",
  "TLFN_2",
  "TLFN_3",
  "TLFN_4",
  "TLFN_5",
  "TEL_COMERCIAL_SIEBEL",
  "TEL_CELULAR_SIEBEL",
  "EMAIL_SIEBEL",
].filter((header) => indexByHeader.has(header));

const uniqueCnpj = new Set();
const allCnpj = new Set();
const uniqueClients = new Set();
const cnpjMetrics = new Map();
const ftthRenewalCnpj = new Set();
const ftthBasicBaseCnpj = new Set();
const ftthOpportunityCnpj = new Set();
const ftthOpportunityCityByCnpj = new Map();
const mobileOpportunityCnpj = new Set();
const digitalOpportunityCnpj = new Set();
const advancedOpportunityCnpj = new Set();
const advancedAcquisitionWinbackCnpj = new Set();
const advancedRenewalCnpj = new Set();
const vivoTechOpportunityCnpj = new Set();
const deviceOpportunityCnpj = new Set();
const rawCnpjMobilePark = new Map();
const cityStats = new Map();
const statusDistribution = new Map();
const meiDistribution = new Map();
const mobileComposition = new Map();
const digitalComposition = new Map();

let rawRecords = 0;
let eligibleRecords = 0;
let excludedRecords = 0;
let missingCnpj = 0;
let mobile = 0;
let ftth = 0;
let digital1 = 0;
let aparelhos = 0;
let advanced = 0;
let vivoTech = 0;
let coverage5g = 0;
let recordsWithOpportunity = 0;
let multipleOpportunities = 0;
let recordsWithoutOpportunity = 0;
let onlyMobile = 0;
let onlyFtth = 0;
let onlyDigital1 = 0;
let onlyAdvanced = 0;
let onlyVivoTech = 0;
let contactableRecords = 0;
let mobileParkLines = 0;
let mobilePortfolioValue = 0;
let fixedPortfolioValue = 0;
let semanticPartnerAnomalies = 0;

for (const row of rows) {
  if (row.length === 1 && !normalize(row[0])) continue;
  const sourcePartner = valueAt(row, "NOMEREDE");
  if (partnerFilter && normalizePartnerKey(sourcePartner) !== normalizePartnerKey(partnerName)) {
    continue;
  }
  rawRecords += 1;

  const rawCnpj = valueAt(row, "NR_CNPJ");
  if (rawCnpj) {
    allCnpj.add(rawCnpj);
    rawCnpjMobilePark.set(
      rawCnpj,
      Math.max(rawCnpjMobilePark.get(rawCnpj) ?? 0, parseNumber(valueAt(row, "QT_MOVEL_TERM"))),
    );
  }

  const status = normalizeUpper(valueAt(row, "SITUACAO_RECEITA"));
  const mei = normalizeUpper(valueAt(row, "FLG_MEI"));
  increment(statusDistribution, valueAt(row, "SITUACAO_RECEITA"));
  increment(meiDistribution, valueAt(row, "FLG_MEI"));

  const eligibleStatus = ["", "ATIVO", "ATIVA", "2 - ATIVA"].includes(status);
  const eligibleMei = mei === "" || mei === "NULL";
  const fixedOffer = normalizeUpper(valueAt(row, "FIXA_BASICA"));
  const fixedOfferKey = fixedOffer.normalize("NFD").replace(/\p{Diacritic}/gu, "");
  const hasFtthRenewal = /^(UPGRADE|RENOVA|MIGRA)/.test(fixedOffer);
  const hasFtthCoverage =
    /^(AQUISICAO DE 2P BANDA LARGA|AQUISICAO DE BANDA LARGA|ADESAO DE BANDA LARGA)/.test(
      fixedOfferKey,
    );
  const productType = normalizeUpper(valueAt(row, "TP_PRODUTO"));
  const hasFtthOpportunity =
    hasFtthCoverage && !productType.includes("BASICA") && valueAt(row, "FLG_COBERTURA") === "1";

  if (eligibleStatus && rawCnpj && hasFtthRenewal) {
    ftthRenewalCnpj.add(rawCnpj);
  }
  if (eligibleStatus && rawCnpj && hasFtthOpportunity) {
    ftthOpportunityCnpj.add(rawCnpj);
    if (!ftthOpportunityCityByCnpj.has(rawCnpj)) {
      ftthOpportunityCityByCnpj.set(rawCnpj, valueAt(row, "DS_CIDADE") || "Não informado");
    }
  }

  if (!eligibleStatus || !eligibleMei) {
    excludedRecords += 1;
    continue;
  }

  eligibleRecords += 1;
  const cnpj = valueAt(row, "NR_CNPJ");
  const client = valueAt(row, "COD_CLIENTE");
  if (cnpj) uniqueCnpj.add(cnpj);
  else missingCnpj += 1;
  if (client) uniqueClients.add(client);

  const recMovel = valueAt(row, "REC_MOVEL");
  const mobileType = recMovel ? mobileCategory(recMovel) : null;
  const hasMobile = mobileType === "Aquisição" || mobileType === "Winback";
  const hasFtth = hasFtthCoverage && !productType.includes("BASICA");
  if (cnpj && productType.includes("BASICA")) ftthBasicBaseCnpj.add(cnpj);
  const digitalOne = valueAt(row, "DIGITAL_1");
  const hasDigital1 = digitalOne !== "";
  const advancedOffer = valueAt(row, "AVANCADOS");
  const hasAdvanced = advancedOffer !== "";
  const advancedOfferKey = normalizeUpper(advancedOffer)
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  const hasAdvancedAcquisitionOrWinback = /^(AQUISICAO|WINBACK)/.test(advancedOfferKey);
  const hasAdvancedRenewal = /^RENOVACAO/.test(advancedOfferKey);
  const hasVivoTech = valueAt(row, "VIVO_TECH") !== "";
  const devices = valueAt(row, "APARELHOS");
  const hasDevices = devices !== "";
  const deviceCredit = parseDeviceCredit(devices);
  const has5g = valueAt(row, "COBERTURA_5G") !== "";
  const opportunityCount = Number(hasMobile) + Number(hasFtth) + Number(hasDigital1);
  const contactable = contactHeaders.some((header) => valueAt(row, header) !== "");

  if (cnpj && hasMobile) mobileOpportunityCnpj.add(cnpj);
  if (cnpj && hasDigital1) digitalOpportunityCnpj.add(cnpj);
  if (cnpj && hasAdvanced) advancedOpportunityCnpj.add(cnpj);
  if (cnpj && hasAdvancedAcquisitionOrWinback) advancedAcquisitionWinbackCnpj.add(cnpj);
  if (cnpj && hasAdvancedRenewal) advancedRenewalCnpj.add(cnpj);
  if (cnpj && hasVivoTech) vivoTechOpportunityCnpj.add(cnpj);
  if (cnpj && hasDevices) deviceOpportunityCnpj.add(cnpj);

  if (cnpj) {
    const metric = cnpjMetrics.get(cnpj) ?? {
      hasMobile: false,
      hasMobileRenewal: false,
      hasFtth: false,
      hasDigital1: false,
      hasAdvanced: false,
      hasVivoTech: false,
      hasDevices: false,
      has5g: false,
      contactable: false,
      deviceCredit: 0,
      mobileParkLines: 0,
      ftthParkLines: 0,
      city: "",
      mobileTypes: new Set(),
      digitalTypes: new Set(),
    };
    metric.hasMobile ||= hasMobile;
    metric.hasMobileRenewal ||= mobileType === "Renovação";
    metric.hasFtth ||= hasFtth;
    metric.hasDigital1 ||= hasDigital1;
    metric.hasAdvanced ||= hasAdvanced;
    metric.hasVivoTech ||= hasVivoTech;
    metric.hasDevices ||= hasDevices;
    metric.has5g ||= has5g;
    metric.contactable ||= contactable;
    metric.deviceCredit = Math.max(metric.deviceCredit, deviceCredit);
    metric.mobileParkLines = Math.max(
      metric.mobileParkLines,
      parseNumber(valueAt(row, "QT_MOVEL_TERM")),
    );
    metric.ftthParkLines = Math.max(metric.ftthParkLines, parseNumber(valueAt(row, "QT_BL_FTTH")));
    metric.city ||= valueAt(row, "DS_CIDADE") || "Não informado";

    if (hasMobile && mobileType) metric.mobileTypes.add(mobileType);
    if (hasDigital1) {
      const normalizedDigital = normalizeUpper(digitalOne);
      if (normalizedDigital.includes("MICROSOFT 365")) metric.digitalTypes.add("Microsoft 365");
      else if (normalizedDigital.includes("GOOGLE WORKSPACE"))
        metric.digitalTypes.add("Google Workspace");
      else if (normalizedDigital.includes("SUPORTE VIVO")) metric.digitalTypes.add("Suporte Vivo");
      else metric.digitalTypes.add("Outras ofertas digitais");
    }
    cnpjMetrics.set(cnpj, metric);
  }

  mobile += Number(hasMobile);
  ftth += Number(hasFtth);
  digital1 += Number(hasDigital1);
  advanced += Number(hasAdvanced);
  vivoTech += Number(hasVivoTech);
  aparelhos += Number(hasDevices);
  coverage5g += Number(has5g);
  recordsWithOpportunity += Number(opportunityCount > 0);
  multipleOpportunities += Number(opportunityCount >= 2);
  recordsWithoutOpportunity += Number(opportunityCount === 0);
  onlyMobile += Number(hasMobile && !hasFtth && !hasDigital1);
  onlyFtth += Number(hasFtth && !hasMobile && !hasDigital1);
  onlyDigital1 += Number(hasDigital1 && !hasMobile && !hasFtth);

  if (hasMobile && mobileType) increment(mobileComposition, mobileType);

  if (hasDigital1) {
    const normalizedDigital = normalizeUpper(digitalOne);
    if (normalizedDigital.includes("MICROSOFT 365")) increment(digitalComposition, "Microsoft 365");
    else if (normalizedDigital.includes("GOOGLE WORKSPACE"))
      increment(digitalComposition, "Google Workspace");
    else if (normalizedDigital.includes("SUPORTE VIVO"))
      increment(digitalComposition, "Suporte Vivo");
    else increment(digitalComposition, "Outras ofertas digitais");
  }

  mobileParkLines += parseNumber(valueAt(row, "QT_MOVEL_TERM"));
  mobilePortfolioValue += parseNumber(valueAt(row, "VL_CAR_MOVEL"));
  fixedPortfolioValue += parseNumber(valueAt(row, "VL_CAR_FIXA"));

  contactableRecords += Number(contactable);

  const city = valueAt(row, "DS_CIDADE") || "Não informado";
  const cityCurrent = cityStats.get(city) ?? { records: 0, opportunities: 0 };
  cityCurrent.records += 1;
  cityCurrent.opportunities += opportunityCount;
  cityStats.set(city, cityCurrent);

  if (sourcePartner && normalizePartnerKey(sourcePartner) !== normalizePartnerKey(partnerName)) {
    semanticPartnerAnomalies += 1;
  }
}

mobile = 0;
ftth = 0;
digital1 = 0;
advanced = 0;
vivoTech = 0;
aparelhos = 0;
coverage5g = 0;
recordsWithOpportunity = 0;
multipleOpportunities = 0;
recordsWithoutOpportunity = 0;
onlyMobile = 0;
onlyFtth = 0;
onlyDigital1 = 0;
onlyAdvanced = 0;
onlyVivoTech = 0;
contactableRecords = 0;
mobileParkLines = 0;
let mobileParkLinesWithRecMovel = 0;
let deviceCreditTotal = 0;
let mobileRenewalWithDevice = 0;
let devicesWithoutMobileRenewal = 0;
cityStats.clear();
mobileComposition.clear();
digitalComposition.clear();
const ftthBasicBase = ftthBasicBaseCnpj.size;
const ftthOpportunities = ftthOpportunityCnpj.size;
const ftthOpportunityCityStats = new Map();
for (const city of ftthOpportunityCityByCnpj.values()) {
  ftthOpportunityCityStats.set(city, (ftthOpportunityCityStats.get(city) ?? 0) + 1);
}
let ftthCoverage = 0;
const ftthRenewal = ftthRenewalCnpj.size;
let ftthWithoutPark = 0;
let ftthWithPark = 0;
let ftthConvergent = 0;
let ftthParkWithoutMobile = 0;

for (const metric of cnpjMetrics.values()) {
  const opportunityCount =
    Number(metric.hasMobile) + Number(metric.hasFtth) + Number(metric.hasDigital1);
  mobile += Number(metric.hasMobile);
  ftth += Number(metric.hasFtth);
  digital1 += Number(metric.hasDigital1);
  advanced += Number(metric.hasAdvanced);
  vivoTech += Number(metric.hasVivoTech);
  aparelhos += Number(metric.hasDevices);
  coverage5g += Number(metric.has5g);
  deviceCreditTotal += metric.deviceCredit;
  recordsWithOpportunity += Number(opportunityCount > 0);
  multipleOpportunities += Number(opportunityCount >= 2);
  recordsWithoutOpportunity += Number(opportunityCount === 0);
  onlyMobile += Number(metric.hasMobile && !metric.hasFtth && !metric.hasDigital1);
  onlyFtth += Number(metric.hasFtth && !metric.hasMobile && !metric.hasDigital1);
  onlyDigital1 += Number(metric.hasDigital1 && !metric.hasMobile && !metric.hasFtth);
  contactableRecords += Number(metric.contactable);
  mobileParkLines += metric.mobileParkLines;
  if (metric.hasMobile) mobileParkLinesWithRecMovel += metric.mobileParkLines;
  mobileRenewalWithDevice += Number(metric.hasMobileRenewal && metric.hasDevices);
  devicesWithoutMobileRenewal += Number(metric.hasDevices && !metric.hasMobileRenewal);

  if (metric.hasFtth) {
    const hasFtthPark = metric.ftthParkLines > 0;
    const hasMobilePark = metric.mobileParkLines > 0;
    ftthCoverage += 1;
    ftthWithoutPark += Number(!hasFtthPark);
    ftthWithPark += Number(hasFtthPark);
    ftthConvergent += Number(hasFtthPark && hasMobilePark);
    ftthParkWithoutMobile += Number(hasFtthPark && !hasMobilePark);
  }

  if (metric.hasMobile) {
    const type = metric.mobileTypes.has("Winback")
      ? "Winback"
      : metric.mobileTypes.has("Renovação")
        ? "Renovação"
        : metric.mobileTypes.has("Aquisição")
          ? "Aquisição"
          : "Outras ofertas";
    increment(mobileComposition, type);
  }
  if (metric.hasDigital1) {
    const type = metric.digitalTypes.has("Microsoft 365")
      ? "Microsoft 365"
      : metric.digitalTypes.has("Google Workspace")
        ? "Google Workspace"
        : metric.digitalTypes.has("Suporte Vivo")
          ? "Suporte Vivo"
          : "Outras ofertas digitais";
    increment(digitalComposition, type);
  }

  const cityCurrent = cityStats.get(metric.city) ?? { records: 0, opportunities: 0 };
  cityCurrent.records += 1;
  cityCurrent.opportunities += opportunityCount;
  cityStats.set(metric.city, cityCurrent);
}

// The executive dashboard uses the same FTTH opportunity rule shown on the
// FTTH page. Rebuild its opportunity union at CNPJ level so the KPIs and
// category charts are based on the same commercial opportunity fronts.
const opportunityCnpj = new Set([
  ...mobileOpportunityCnpj,
  ...ftthOpportunityCnpj,
  ...digitalOpportunityCnpj,
  ...advancedOpportunityCnpj,
  ...vivoTechOpportunityCnpj,
  ...deviceOpportunityCnpj,
]);

mobile = mobileOpportunityCnpj.size;
ftth = ftthOpportunityCnpj.size;
digital1 = digitalOpportunityCnpj.size;
advanced = advancedOpportunityCnpj.size;
vivoTech = vivoTechOpportunityCnpj.size;
recordsWithOpportunity = opportunityCnpj.size;
multipleOpportunities = 0;
recordsWithoutOpportunity = 0;
onlyMobile = 0;
onlyFtth = 0;
onlyDigital1 = 0;
onlyAdvanced = 0;
onlyVivoTech = 0;
let onlyDevices = 0;
cityStats.clear();

for (const cnpj of opportunityCnpj) {
  const hasMobile = mobileOpportunityCnpj.has(cnpj);
  const hasFtth = ftthOpportunityCnpj.has(cnpj);
  const hasDigital1 = digitalOpportunityCnpj.has(cnpj);
  const hasAdvanced = advancedOpportunityCnpj.has(cnpj);
  const hasVivoTech = vivoTechOpportunityCnpj.has(cnpj);
  const hasDevices = deviceOpportunityCnpj.has(cnpj);
  const opportunityCount =
    Number(hasMobile) +
    Number(hasFtth) +
    Number(hasDigital1) +
    Number(hasAdvanced) +
    Number(hasVivoTech) +
    Number(hasDevices);

  multipleOpportunities += Number(opportunityCount >= 2);
  onlyMobile += Number(hasMobile && opportunityCount === 1);
  onlyFtth += Number(hasFtth && opportunityCount === 1);
  onlyDigital1 += Number(hasDigital1 && opportunityCount === 1);
  onlyAdvanced += Number(hasAdvanced && opportunityCount === 1);
  onlyVivoTech += Number(hasVivoTech && opportunityCount === 1);
  onlyDevices += Number(hasDevices && opportunityCount === 1);

  const city =
    cnpjMetrics.get(cnpj)?.city ?? ftthOpportunityCityByCnpj.get(cnpj) ?? "Não informado";
  const cityCurrent = cityStats.get(city) ?? { records: 0, opportunities: 0 };
  cityCurrent.records += 1;
  cityCurrent.opportunities += opportunityCount;
  cityStats.set(city, cityCurrent);
}

for (const cnpj of uniqueCnpj) {
  recordsWithoutOpportunity += Number(!opportunityCnpj.has(cnpj));
}

const totalOpportunityEvents = mobile + ftth + digital1 + advanced + vivoTech + aparelhos;
const mobileParkLinesUnfiltered = [...rawCnpjMobilePark.values()].reduce(
  (total, value) => total + value,
  0,
);
const snapshot = {
  schemaVersion: 1,
  source: {
    fileName: path.basename(inputPath),
    fileSizeBytes: raw.length,
    encoding: decoded.encoding,
    delimiter: ";",
    importedAt: new Date().toISOString(),
    sourceModifiedAt: stats.mtime.toISOString(),
  },
  rules: {
    version: "mapa-parque-v1",
    situation: "SITUACAO_RECEITA em branco ou equivalente a ATIVO (ATIVO, ATIVA, 2 - ATIVA)",
    mei: "FLG_MEI vazio ou NULL",
    mobile: "REC_MOVEL contém Aquisição ou Winback",
    mobileRenewalWithDevice: "REC_MOVEL contém Renovação e APARELHOS preenchido",
    devicesWithoutMobileRenewal: "APARELHOS preenchido sem REC_MOVEL de Renovação para o CNPJ",
    ftth: "FIXA_BASICA começa com Aquisição de 2P Banda Larga, Aquisição de Banda Larga ou Adesão de Banda Larga; TP_PRODUTO não contém BASICA",
    ftthPenetrationBase: "TP_PRODUTO contém BASICA",
    ftthOpportunities:
      "SITUACAO_RECEITA em branco, ATIVO, ATIVA ou 2 - ATIVA; FLG_COBERTURA = 1; FIXA_BASICA nos grupos de aquisição/adesão de banda larga; TP_PRODUTO não contém BASICA; sem filtro de FLG_MEI",
    ftthRenewal:
      "SITUACAO_RECEITA em branco, ATIVO, ATIVA ou 2 - ATIVA; FIXA_BASICA começa com Upgrade, Renovação ou Migração; sem filtro de FLG_MEI",
    digital1: "DIGITAL_1 preenchido",
    advanced: "AVANCADOS preenchido",
    advancedAcquisitionWinback: "AVANCADOS começa com Aquisição ou Winback",
    advancedRenewal: "AVANCADOS começa com Renovação",
    vivoTech: "VIVO_TECH preenchido",
    devices: "APARELHOS preenchido",
  },
  partners: [{ id: formatPartnerId(partnerName), name: partnerName }],
  totals: {
    rawRecords,
    eligibleRecords,
    excludedRecords,
    uniqueCnpj: uniqueCnpj.size,
    allCnpj: allCnpj.size,
    uniqueClients: uniqueClients.size,
    missingCnpj,
    recurringCnpjRows: Math.max(0, eligibleRecords - uniqueCnpj.size),
    contactableRecords,
    mobileParkLines,
    mobileParkLinesUnfiltered,
    mobilePortfolioValue,
    fixedPortfolioValue,
    totalPortfolioValue: mobilePortfolioValue + fixedPortfolioValue,
  },
  opportunities: {
    mobile,
    mobileParkLines: mobileParkLinesWithRecMovel,
    mobileRenewalWithDevice,
    devicesWithoutMobileRenewal,
    ftth,
    digital1,
    advanced,
    advancedAcquisitionWinback: advancedAcquisitionWinbackCnpj.size,
    advancedRenewal: advancedRenewalCnpj.size,
    vivoTech,
    devices: aparelhos,
    deviceCredit: deviceCreditTotal,
    coverage5g,
    totalEvents: totalOpportunityEvents,
    recordsWithOpportunity,
    uniqueCnpjWithOpportunity: recordsWithOpportunity,
    multipleOpportunities,
    recordsWithoutOpportunity,
    percentageWithOpportunity: allCnpj.size === 0 ? 0 : recordsWithOpportunity / allCnpj.size,
  },
  breakdowns: {
    byType: [
      { tipo: "Móvel", valor: mobile },
      { tipo: "FTTH", valor: ftth },
      { tipo: "Oferta Digital", valor: digital1 },
      { tipo: "Avançada", valor: advanced },
      { tipo: "Vivo Tech", valor: vivoTech },
      { tipo: "Aparelhos", valor: aparelhos },
    ],
    byCategory: [
      { categoria: "Múltiplas oportunidades", valor: multipleOpportunities },
      { categoria: "Somente Oferta Digital", valor: onlyDigital1 },
      { categoria: "Somente móvel", valor: onlyMobile },
      { categoria: "Somente Avançada", valor: onlyAdvanced },
      { categoria: "Somente FTTH", valor: onlyFtth },
      { categoria: "Somente Vivo Tech", valor: onlyVivoTech },
      { categoria: "Somente Aparelhos", valor: onlyDevices },
    ].sort((a, b) => b.valor - a.valor || a.categoria.localeCompare(b.categoria, "pt-BR")),
    byCity: [...cityStats.entries()]
      .map(([cidade, values]) => ({ cidade, ...values }))
      .sort(
        (a, b) => b.opportunities - a.opportunities || a.cidade.localeCompare(b.cidade, "pt-BR"),
      )
      .slice(0, 12),
    mobileComposition: ["Aquisição", "Renovação", "Winback", "Outras ofertas"].map((tipo) => ({
      tipo,
      valor: mobileComposition.get(tipo) ?? 0,
    })),
    ftth: {
      cobertura: ftthCoverage,
      oportunidades: ftthOpportunities,
      baseBasica: ftthBasicBase,
      penetracaoBase:
        ftthBasicBase + ftthOpportunities === 0
          ? 0
          : ftthBasicBase / (ftthBasicBase + ftthOpportunities),
      renovacao: ftthRenewal,
      semFtthNoParque: ftthWithoutPark,
      comFtthNoParque: ftthWithPark,
      convergentes: ftthConvergent,
      composicao: [
        { tipo: "Sem FTTH no parque", valor: ftthWithoutPark },
        { tipo: "FTTH sem móvel", valor: ftthParkWithoutMobile },
        { tipo: "Convergente móvel + FTTH", valor: ftthConvergent },
      ],
      oportunidadesPorCidade: [...ftthOpportunityCityStats.entries()]
        .map(([cidade, oportunidades]) => ({ cidade, oportunidades }))
        .sort(
          (a, b) => b.oportunidades - a.oportunidades || a.cidade.localeCompare(b.cidade, "pt-BR"),
        )
        .slice(0, 12),
    },
    digitalComposition: orderedEntries(digitalComposition, 10).map(({ label, value }) => ({
      tipo: label,
      valor: value,
    })),
    status: orderedEntries(statusDistribution, 10),
    mei: orderedEntries(meiDistribution, 10),
  },
  quality: {
    malformedColumnRows: 0,
    semanticPartnerAnomalies,
    sourceMojibakeDetected: /[ÃÂâ]/.test(decoded.text),
  },
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      outputPath,
      partner: partnerName,
      rawRecords,
      eligibleRecords,
      uniqueCnpj: uniqueCnpj.size,
      uniqueClients: uniqueClients.size,
      totalOpportunityEvents,
      recordsWithOpportunity,
    },
    null,
    2,
  ),
);
