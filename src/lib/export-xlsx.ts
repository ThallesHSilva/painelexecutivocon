import { PORTFOLIO, type PortfolioRow } from "@/mocks/data";

type ExportKind =
  | "oportunidades"
  | "movel"
  | "ftth"
  | "digital"
  | "avancada"
  | "vivo-tech"
  | "contato"
  | "aparelhos"
  | "renovacao-aparelho"
  | "aparelhos-sem-renovacao";

const labels: Record<ExportKind, string> = {
  oportunidades: "CNPJs com oportunidade",
  movel: "Oportunidade Móvel",
  ftth: "Oportunidades de FTTH",
  digital: "CNPJs com Oferta Digital",
  avancada: "Oportunidade de Avançada",
  "vivo-tech": "Oportunidade Vivo Tech",
  contato: "CNPJs com contato",
  aparelhos: "CNPJs com oportunidade aparelhos",
  "renovacao-aparelho": "Renovação Móvel + Aparelho",
  "aparelhos-sem-renovacao": "Aparelho sem renovação",
};

function xmlEscape(value: unknown) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function matches(row: PortfolioRow, kind: ExportKind) {
  switch (kind) {
    case "movel":
      return row.oportMovel;
    case "ftth":
      return row.oportFtth;
    case "digital":
      return row.oportLicencas;
    case "avancada":
      return row.qtdOportunidades >= 3;
    case "vivo-tech":
      return row.servicosDigitais;
    case "contato":
      return Boolean(row.cnpj);
    case "aparelhos":
      return row.parqueMovel > 0;
    case "renovacao-aparelho":
      return row.oportMovel && row.servicosDigitais;
    case "aparelhos-sem-renovacao":
      return row.parqueMovel > 0 && !row.oportMovel;
    case "oportunidades":
      return row.oportMovel || row.oportFtth || row.oportLicencas || row.servicosDigitais;
  }
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value: number) {
  return new Uint8Array([value & 255, (value >>> 8) & 255]);
}
function u32(value: number) {
  return new Uint8Array([
    value & 255,
    (value >>> 8) & 255,
    (value >>> 16) & 255,
    (value >>> 24) & 255,
  ]);
}
function concat(parts: Uint8Array[]) {
  const result = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function zip(files: Array<{ name: string; data: string }>) {
  const encoder = new TextEncoder();
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.data);
    const crc = crc32(data);
    local.push(
      concat([
        u32(0x04034b50),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(data.length),
        u32(data.length),
        u16(name.length),
        u16(0),
        name,
        data,
      ]),
    );
    central.push(
      concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(data.length),
        u32(data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ]),
    );
    offset += local[local.length - 1].length;
  }
  const centralData = concat(central);
  return concat([
    ...local,
    centralData,
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralData.length),
    u32(offset),
    u16(0),
  ]);
}

function sheet(rows: string[][]) {
  const body = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, columnIndex) => {
          const reference = `${String.fromCharCode(65 + columnIndex)}${rowIndex + 1}`;
          const numeric = rowIndex > 0 && /^-?\d+(\.\d+)?$/.test(value);
          return numeric
            ? `<c r="${reference}"><v>${value}</v></c>`
            : `<c r="${reference}" t="inlineStr"><is><t>${xmlEscape(value)}</t></is></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}

export function exportOpportunityBase(kind: ExportKind, partnerIds: string[]) {
  const scoped = PORTFOLIO.filter((row) =>
    partnerIds.length ? partnerIds.includes(row.partnerId) : true,
  );
  const unique = new Map(scoped.filter((row) => matches(row, kind)).map((row) => [row.cnpj, row]));
  const rows = [
    [
      "CNPJ",
      "Razão social",
      "Parceiro",
      "Município",
      "UF",
      "Parque móvel",
      "REC_MOVEL",
      "Oportunidade",
    ],
    ...[...unique.values()].map((row) => [
      row.cnpj,
      row.razaoSocial,
      row.partnerName,
      row.municipio,
      row.uf,
      String(row.parqueMovel),
      String(row.recMovel),
      labels[kind],
    ]),
  ];
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Clientes" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;
  const bytes = zip([
    { name: "[Content_Types].xml", data: contentTypes },
    { name: "_rels/.rels", data: rels },
    { name: "xl/workbook.xml", data: workbook },
    { name: "xl/_rels/workbook.xml.rels", data: workbookRels },
    { name: "xl/worksheets/sheet1.xml", data: sheet(rows) },
  ]);
  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${kind}-clientes-${new Date().toISOString().slice(0, 10)}.xlsx`;
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  return unique.size;
}
