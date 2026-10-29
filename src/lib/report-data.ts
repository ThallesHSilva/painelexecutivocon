import { summarizeByDirectorate, summarizeByMonth, type InvasaoSnapshot } from "./invasao.ts";

/** Every source row is kept, in order; even an empty section gets one explicit sheet. */
export function reportChunks<T>(rows: T[], size = 12): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new Error("Tamanho de página inválido.");
  return rows.length
    ? Array.from({ length: Math.ceil(rows.length / size) }, (_, index) =>
        rows.slice(index * size, (index + 1) * size),
      )
    : [[]];
}

export type TowerLayoutUnit = {
  /** Cabe dividindo a folha com outra torre. */
  compact: boolean;
  /** Primeira folha da torre Banda Larga: a portabilidade entra imediatamente antes dela. */
  beforePortability: boolean;
};
export type TowerLayoutItem<T> = { kind: "towers"; units: T[] } | { kind: "portability" };

/**
 * Ordem das folhas do capítulo de torres: torres compactas consecutivas dividem a folha
 * de duas em duas; uma torre grande ocupa a folha sozinha; a portabilidade fica antes da
 * Banda Larga e interrompe o emparelhamento, nunca dividindo folha com uma torre. Sem
 * Banda Larga, a portabilidade fecha o capítulo. Nenhuma torre é omitida nem reordenada.
 */
export function layoutTowerPages<T extends TowerLayoutUnit>(units: T[]): TowerLayoutItem<T>[] {
  const portabilityAt = units.findIndex((unit) => unit.beforePortability);
  const items: TowerLayoutItem<T>[] = [];
  let waiting: T[] = [];
  const flush = () => {
    if (waiting.length) items.push({ kind: "towers", units: waiting });
    waiting = [];
  };
  for (const [index, unit] of units.entries()) {
    if (index === portabilityAt) {
      flush();
      items.push({ kind: "portability" });
    }
    if (!unit.compact) {
      flush();
      items.push({ kind: "towers", units: [unit] });
    } else if (waiting.length) {
      items.push({ kind: "towers", units: [...waiting, unit] });
      waiting = [];
    } else {
      waiting = [unit];
    }
  }
  flush();
  if (portabilityAt < 0) items.push({ kind: "portability" });
  return items;
}

export function invasaoReportSummary(snapshot: InvasaoSnapshot) {
  const latestMonth = [...snapshot.months].sort().at(-1) ?? "";
  const directorates = summarizeByDirectorate(
    snapshot.records.filter((row) => row.month === latestMonth),
  );
  const history = summarizeByMonth(snapshot.records, snapshot.months);
  const total = (rows: { altasMovel: number; altasFtth: number }[]) =>
    rows.reduce(
      (sum, row) => ({
        altasMovel: sum.altasMovel + row.altasMovel,
        altasFtth: sum.altasFtth + row.altasFtth,
      }),
      { altasMovel: 0, altasFtth: 0 },
    );
  return {
    latestMonth,
    directorates,
    history,
    monthTotal: total(directorates),
    periodTotal: total(history),
  };
}
