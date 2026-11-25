import type { ServiceTower } from "./snapshot-types";

const key = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export function towerRankingColumns(tower: ServiceTower) {
  const column = ["bgxpc", "xpc", "estxpc", "pc", "meta"].flatMap((label) =>
    tower.columns.filter((c) => key(c.label) === label && c.format === "percent"),
  )[0];
  return column ? [column] : [];
}
export function towerRanking(tower: ServiceTower) {
  const columns = towerRankingColumns(tower);
  return [...tower.rows].sort((a, b) => {
    for (const column of columns) {
      const av = a.values[column.key],
        bv = b.values[column.key];
      const left = typeof av === "number" && Number.isFinite(av) ? av : -Infinity;
      const right = typeof bv === "number" && Number.isFinite(bv) ? bv : -Infinity;
      if (left !== right) return left > right ? -1 : 1;
    }
    return columns.length ? a.partner.localeCompare(b.partner, "pt-BR") : 0;
  });
}

export function towerImageColumns(tower: ServiceTower) {
  // Match the commercial metric used in each reference, without summing percentages.
  const priorities =
    tower.id === "vivo-tech"
      ? ["esteira"]
      : tower.id === "aparelhos"
        ? ["bestguess", "ativado", "forecast"]
        : ["dados-avancados", "ti-recorrente", "voz", "vvn"].includes(tower.id)
          ? ["ativado", "forecast", "bestguess"]
          : ["bestguess", "bg", "ativado", "forecast", "esteira"];
  const metric =
    priorities.flatMap((label) => tower.columns.filter((c) => key(c.label) === label))[0] ??
    tower.columns.find((c) => c.format !== "percent");
  const ratio = towerRankingColumns(tower)[0];
  return { metric, ratio };
}

export async function renderTowerRankingImage(towers: ServiceTower[], date: string): Promise<Blob> {
  await document.fonts.ready;
  const width = 1080,
    margin = 24,
    gap = 16;
  const colWidth = (width - margin * 2 - gap * (towers.length - 1)) / towers.length;
  const count = Math.max(...towers.map((tower) => tower.rows.length));
  const rowHeight = 46,
    tableY = 300,
    tableHeight = 104 + count * rowHeight + 52;
  const insightY = tableY + tableHeight + 24;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = insightY + 536;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador não permite gerar a imagem.");
  const purple = "#520099",
    dark = "#26005b";
  function box(x: number, y: number, w: number, h: number, color: string, radius = 12) {
    ctx!.fillStyle = color;
    ctx!.beginPath();
    ctx!.roundRect(x, y, w, h, radius);
    ctx!.fill();
  }
  function text(
    value: string,
    x: number,
    y: number,
    size: number,
    color = dark,
    weight = 500,
    maxWidth = width,
  ) {
    ctx!.font = `${weight} ${size}px Inter, Arial, sans-serif`;
    ctx!.fillStyle = color;
    // Fit using wrapping/ellipsis instead of squeezing glyphs.
    let label = value;
    while (ctx!.measureText(label).width > maxWidth && label.length > 1)
      label = label.slice(0, -2) + "…";
    ctx!.fillText(label, x, y);
  }
  function paragraph(value: string, x: number, y: number, w: number, size = 20) {
    ctx!.font = `500 ${size}px Inter, Arial, sans-serif`;
    let line = "",
      lineY = y;
    let lines = 0;
    for (const word of value.split(/\s+/)) {
      if (ctx!.measureText(`${line} ${word}`).width > w && line) {
        if (++lines >= 3) {
          text(line + "…", x, lineY, size, dark, 500, w);
          return lineY;
        }
        text(line, x, lineY, size);
        lineY += size * 1.45;
        line = word;
      } else line = line ? `${line} ${word}` : word;
    }
    text(line, x, lineY, size);
    return lineY;
  }
  const format = (value: string | number | null | undefined, money = false, percent = false) => {
    if (value == null || (typeof value === "number" && !Number.isFinite(value))) return "—";
    if (typeof value === "string") return value;
    return new Intl.NumberFormat(
      "pt-BR",
      percent
        ? { style: "percent", maximumFractionDigits: 0 }
        : money
          ? { style: "currency", currency: "BRL", maximumFractionDigits: 0 }
          : { maximumFractionDigits: 0 },
    ).format(value);
  };
  box(0, 0, width, canvas.height, "#f6f4fb", 0);
  const gradient = ctx.createLinearGradient(0, 0, width, 150);
  gradient.addColorStop(0, dark);
  gradient.addColorStop(1, purple);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, 144);
  box(24, 26, 7, 86, "#c49bff", 0);
  text("RANKING PRODUTOS CON · PARCEIROS B2B", 48, 62, 30, "white", 800, 980);
  text(`Torres de serviço · Imagem de ${date}`, 48, 105, 23, "#eee0ff");
  text("RANKING COMPLETO DO ESCOPO AUTORIZADO", margin, 177, 16, "#675576", 700);
  towers.forEach((tower, index) => {
    const x = margin + index * (colWidth + gap);
    const { metric, ratio } = towerImageColumns(tower);
    const money = !["altas-movel", "banda-larga", "vivo-tech"].includes(tower.id);
    const total = metric ? tower.total[metric.key] : null;
    box(x, 194, colWidth, 88, "white");
    text(tower.title.toUpperCase(), x + 16, 220, 17, purple, 800, colWidth - 32);
    text(format(total, money), x + 16, 259, 30, dark, 800, colWidth * 0.62);
    text(
      format(ratio ? tower.total[ratio.key] : null, false, true),
      x + colWidth * 0.72,
      259,
      27,
      purple,
      800,
      colWidth * 0.26,
    );
    box(x, tableY, colWidth, tableHeight, "white");
    box(x, tableY, colWidth, 54, purple);
    text(tower.title.toUpperCase(), x + 16, tableY + 36, 24, "white", 800, colWidth - 32);
    box(x, tableY + 54, colWidth, 50, dark, 0);
    text("Parceiro", x + 14, tableY + 86, 18, "white", 600);
    text(
      metric?.label ?? "Valor",
      x + colWidth * 0.52,
      tableY + 86,
      17,
      "white",
      600,
      colWidth * 0.25,
    );
    text(
      ratio?.label ?? "Meta",
      x + colWidth * 0.8,
      tableY + 86,
      17,
      "white",
      600,
      colWidth * 0.18,
    );
    const ranked = towerRanking(tower);
    ranked.forEach((row, position) => {
      const y = tableY + 104 + position * rowHeight;
      if (position % 2 === 1) box(x, y, colWidth, rowHeight, "#f2eef8", 0);
      text(`${position + 1}º`, x + 12, y + 30, 18, dark, 700);
      text(row.partner, x + 55, y + 30, 18, dark, 700, colWidth * 0.49 - 55);
      text(
        format(metric ? row.values[metric.key] : null, money),
        x + colWidth * 0.52,
        y + 30,
        18,
        dark,
        500,
        colWidth * 0.26,
      );
      const value = ratio ? row.values[ratio.key] : null;
      const color =
        typeof value !== "number"
          ? "#e8e1ef"
          : value >= 1
            ? "#087447"
            : value >= 0.8
              ? "#925a08"
              : "#b42336";
      box(x + colWidth * 0.8, y + 6, colWidth * 0.18, rowHeight - 12, color, 6);
      text(
        format(value, false, true),
        x + colWidth * 0.8 + 8,
        y + 29,
        18,
        typeof value === "number" ? "white" : dark,
        700,
        colWidth * 0.18 - 14,
      );
    });
    const bottom = tableY + tableHeight - 52;
    box(x, bottom, colWidth, 52, purple, 0);
    text("Total TT", x + 14, bottom + 34, 21, "white", 700);
    text(format(total, money), x + colWidth * 0.52, bottom + 34, 20, "white", 700, colWidth * 0.26);
    text(
      format(ratio ? tower.total[ratio.key] : null, false, true),
      x + colWidth * 0.8,
      bottom + 34,
      20,
      "white",
      700,
      colWidth * 0.18,
    );
    box(x, insightY, colWidth, 462, "white");
    box(x, insightY, colWidth, 48, purple);
    text("COMPORTAMENTO POR PRODUTO", x + 16, insightY + 31, 19, "white", 700, colWidth - 32);
    const numeric = metric
      ? tower.rows
          .filter(
            (r) => typeof r.values[metric.key] === "number" && Number(r.values[metric.key]) > 0,
          )
          .sort((a, b) => Number(b.values[metric.key]) - Number(a.values[metric.key]))
      : [];
    const top = numeric.slice(0, 3);
    const share =
      typeof total === "number" && total > 0
        ? top.reduce((sum, r) => sum + Number(r.values[metric!.key]), 0) / total
        : null;
    text("Concentração por volume", x + 16, insightY + 82, 18, purple, 700);
    text(
      share == null
        ? "Sem volume positivo informado"
        : share > 1
          ? "Volumes excedem o total TT"
          : `Top ${top.length} = ${format(share, false, true)} do total TT`,
      x + 16,
      insightY + 117,
      25,
      dark,
      800,
      colWidth - 32,
    );
    paragraph(
      top.length
        ? top.map((r) => `${r.partner} (${format(r.values[metric!.key], money)})`).join(" · ")
        : "Nenhum parceiro com volume positivo.",
      x + 16,
      insightY + 151,
      colWidth - 32,
      17,
    );
    text("Destaques do ranking", x + 16, insightY + 238, 18, purple, 700);
    paragraph(
      ranked.length
        ? `1º ${ranked[0].partner}${ratio ? ` · ${format(ranked[0].values[ratio.key], false, true)} em ${ratio.label}` : ""}. ${ratio ? ranked.filter((r) => typeof r.values[ratio.key] === "number" && Number(r.values[ratio.key]) >= 1).length + " parceiros atingiram 100% ou mais." : "Ordem conforme a base importada."}`
        : "Sem parceiros nesta torre.",
      x + 16,
      insightY + 272,
      colWidth - 32,
      19,
    );
    text("Foco do dia", x + 16, insightY + 370, 18, purple, 700);
    const zeros = metric ? tower.rows.filter((r) => r.values[metric.key] === 0).length : 0;
    const missing = metric ? tower.rows.filter((r) => r.values[metric.key] == null).length : 0;
    paragraph(
      `${zeros} parceiros com volume zero. ${missing} sem volume informado. Priorizar a revisão dessas carteiras.`,
      x + 16,
      insightY + 404,
      colWidth - 32,
      18,
    );
  });
  text(
    "Totais e percentuais TT preservados da base. — = dado não informado; 0 = zero informado.",
    margin,
    canvas.height - 30,
    16,
    "#675576",
    500,
    width - 48,
  );
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Falha ao gerar PNG."))),
      "image/png",
    ),
  );
}
