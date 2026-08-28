type ZipEntry = {
  compression: number;
  compressedSize: number;
  offset: number;
};

const textDecoder = new TextDecoder("utf-8");

function findEndOfCentralDirectory(bytes: Uint8Array) {
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65_557); index -= 1) {
    if (new DataView(bytes.buffer, bytes.byteOffset + index, 4).getUint32(0, true) === 0x06054b50) return index;
  }
  throw new Error("Arquivo XLSX inválido: diretório ZIP não encontrado.");
}

function readZipDirectory(bytes: Uint8Array) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = findEndOfCentralDirectory(bytes);
  const entryCount = view.getUint16(end + 10, true);
  let pointer = view.getUint32(end + 16, true);
  const entries = new Map<string, ZipEntry>();

  for (let index = 0; index < entryCount; index += 1) {
    if (view.getUint32(pointer, true) !== 0x02014b50) throw new Error("Arquivo XLSX inválido: entrada ZIP inesperada.");
    const compression = view.getUint16(pointer + 10, true);
    const compressedSize = view.getUint32(pointer + 20, true);
    const nameLength = view.getUint16(pointer + 28, true);
    const extraLength = view.getUint16(pointer + 30, true);
    const commentLength = view.getUint16(pointer + 32, true);
    const offset = view.getUint32(pointer + 42, true);
    const name = textDecoder.decode(bytes.slice(pointer + 46, pointer + 46 + nameLength));
    entries.set(name, { compression, compressedSize, offset });
    pointer += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function unzipEntry(bytes: Uint8Array, entry: ZipEntry) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(entry.offset, true) !== 0x04034b50) throw new Error("Arquivo XLSX inválido: conteúdo ZIP não encontrado.");
  const nameLength = view.getUint16(entry.offset + 26, true);
  const extraLength = view.getUint16(entry.offset + 28, true);
  const start = entry.offset + 30 + nameLength + extraLength;
  const compressed = bytes.slice(start, start + entry.compressedSize);
  if (entry.compression === 0) return compressed;
  if (entry.compression !== 8) throw new Error("Formato de compressão XLSX não suportado.");

  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function columnIndex(reference: string) {
  const letters = reference.match(/[A-Z]+/i)?.[0] ?? "A";
  return [...letters.toUpperCase()].reduce((index, letter) => index * 26 + letter.charCodeAt(0) - 64, 0) - 1;
}

function parseXml(xml: string, message: string) {
  const document = new DOMParser().parseFromString(xml, "application/xml");
  if (document.querySelector("parsererror")) throw new Error(message);
  return document;
}

export async function readXlsxRows(file: File): Promise<unknown[][]> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const entries = readZipDirectory(bytes);
  const sheetEntry = entries.get("xl/worksheets/sheet1.xml");
  if (!sheetEntry) throw new Error("A primeira aba da planilha não foi encontrada.");

  const sharedEntry = entries.get("xl/sharedStrings.xml");
  const sharedStrings = sharedEntry
    ? [
        ...parseXml(
          textDecoder.decode(await unzipEntry(bytes, sharedEntry)),
          "Não foi possível ler os textos da planilha.",
        ).getElementsByTagNameNS("*", "si"),
      ]
        .map((node) => node.textContent ?? "")
    : [];
  const sheet = parseXml(textDecoder.decode(await unzipEntry(bytes, sheetEntry)), "Não foi possível ler a aba da planilha.");

  return [...sheet.getElementsByTagNameNS("*", "row")].map((row) => {
    const cells: unknown[] = [];
    let nextIndex = 0;
    [...row.getElementsByTagNameNS("*", "c")].forEach((cell) => {
      const reference = cell.getAttribute("r");
      const index = reference ? columnIndex(reference) : nextIndex;
      nextIndex = index + 1;
      const type = cell.getAttribute("t");
      const rawValue = cell.getElementsByTagNameNS("*", "v")[0]?.textContent ?? "";
      const value = type === "s"
        ? sharedStrings[Number(rawValue)] ?? ""
        : type === "inlineStr"
          ? cell.getElementsByTagNameNS("*", "is")[0]?.textContent ?? ""
          : type === "str"
            ? rawValue
            : rawValue === ""
              ? null
              : Number(rawValue);
      cells[index] = value;
    });
    return cells;
  });
}
