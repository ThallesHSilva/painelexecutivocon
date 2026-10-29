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
