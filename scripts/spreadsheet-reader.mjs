import fs from "node:fs/promises";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

function decodeXml(value) {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function columnIndex(reference) {
  const letters = reference.match(/[A-Z]+/i)?.[0]?.toUpperCase() ?? "A";
  return [...letters].reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function unzipEntry(bytes, entry) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const nameLength = view.getUint16(entry.offset + 26, true);
  const extraLength = view.getUint16(entry.offset + 28, true);
  const start = entry.offset + 30 + nameLength + extraLength;
  const compressed = bytes.subarray(start, start + entry.compressedSize);
  return entry.compression === 0 ? compressed : inflateRawSync(compressed);
}

function zipEntries(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65_557); index -= 1) {
    if (view.getUint32(index, true) === 0x06054b50) {
      end = index;
      break;
    }
  }
  if (end < 0) throw new Error("Arquivo XLSX inválido.");
  const entryCount = view.getUint16(end + 10, true);
  let cursor = view.getUint32(end + 16, true);
  const entries = new Map();
  for (let index = 0; index < entryCount; index += 1) {
    const compression = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const offset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    entries.set(name, { compression, compressedSize, offset });
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

function parseCsv(text) {
  const delimiter = (text.match(/;/g)?.length ?? 0) >= (text.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') quoted = false;
      else field += character;
    } else if (character === '"') quoted = true;
    else if (character === delimiter) {
      row.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => String(value).trim())) rows.push(row);
      row = [];
      field = "";
    } else field += character;
  }
  if (row.length || field) rows.push([...row, field]);
  return rows;
}

export async function readSpreadsheetRows(filePath) {
  const bytes = await fs.readFile(filePath);
  if (path.extname(filePath).toLowerCase() === ".csv")
    return parseCsv(new TextDecoder().decode(bytes));
  const entries = zipEntries(bytes);
  const sheetEntry = entries.get("xl/worksheets/sheet1.xml");
  if (!sheetEntry) throw new Error("A primeira aba da planilha não foi encontrada.");
  const sharedEntry = entries.get("xl/sharedStrings.xml");
  const shared = sharedEntry
    ? [
        ...new TextDecoder()
          .decode(unzipEntry(bytes, sharedEntry))
          .matchAll(/<(?:\w+:)?si[^>]*>([\s\S]*?)<\/(?:\w+:)?si>/g),
      ].map(([, value]) =>
        decodeXml(
          [...value.matchAll(/<(?:\w+:)?t[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)]
            .map((match) => match[1])
            .join(""),
        ),
      )
    : [];
  const sheet = new TextDecoder().decode(unzipEntry(bytes, sheetEntry));
  return [...sheet.matchAll(/<(?:\w+:)?row\b[^>]*>([\s\S]*?)<\/(?:\w+:)?row>/g)].map(([, rowXml]) => {
    const row = [];
    let nextIndex = 0;
    for (const [, attributes, body = ""] of rowXml.matchAll(
      /<(?:\w+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g,
    )) {
      const reference = attributes.match(/\br="([A-Z]+\d+)"/)?.[1];
      const type = attributes.match(/\bt="([^"]+)"/)?.[1] ?? "";
      const index = reference ? columnIndex(reference) : nextIndex;
      nextIndex = index + 1;
      const raw = body.match(/<(?:\w+:)?v>([\s\S]*?)<\/(?:\w+:)?v>/)?.[1] ?? "";
      const inline = body.match(/<(?:\w+:)?t[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/)?.[1] ?? "";
      row[index] =
        type === "s" ? (shared[Number(raw)] ?? "") : type === "inlineStr" ? decodeXml(inline) : raw;
    }
    return row;
  });
}

export function normalizeHeader(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR")
    .replace(/[^A-Z0-9]/g, "");
}

export function parseNumber(value) {
  const source = String(value ?? "").trim();
  if (!source) return 0;
  const normalized = source.includes(",") ? source.replaceAll(".", "").replace(",", ".") : source;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}
