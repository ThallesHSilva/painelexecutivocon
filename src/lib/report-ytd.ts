/**
 * Consolidação YTD/YoY do relatório executivo.
 *
 * Snapshots legados podem não trazer os campos derivados (`attainment`, `gap`,
 * `average`, `yoy`, `yoyGap`). Somar esses campos diretamente propagava `NaN` para o
 * relatório impresso. Aqui a ausência é representada explicitamente como `null` e
 * apresentada como "—"; ausência nunca vira zero, porque zero é um resultado real.
 *
 * As regras de cálculo são as mesmas da visão Resultados e não mudam:
 * - um único registro do produto preserva os campos importados;
 * - vários registros somam metas/reais/gaps e recalculam
 *   `attainment = real/meta` e `yoy = real/previousReal - 1`, com zero quando o
 *   denominador é zero.
 *
 * Módulo sem dependências de React ou de alias de import: é exercitado diretamente
 * por `report-ytd.test.ts`.
 */

export type YtdSourceRecord = {
  product: string;
  meta?: number | null;
  real?: number | null;
  previousReal?: number | null;
  attainment?: number | null;
  gap?: number | null;
  average?: number | null;
  yoy?: number | null;
  yoyGap?: number | null;
};

export type YtdSummary = {
  product: string;
  meta: number;
  real: number;
  previousReal: number;
  attainment: number | null;
  gap: number | null;
  average: number | null;
  yoyGap: number | null;
  yoy: number | null;
};

/** Normalização usada para casar torre e produto; preservada do relatório original. */
export function normalizeProduct(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

const finiteOrNull = (value: number | undefined | null) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

function sumAvailable(values: Array<number | null>): number | null {
  const available = values.filter((value): value is number => value != null);
  return available.length ? available.reduce((total, value) => total + value, 0) : null;
}

export function buildYtdSummary(product: string, records: YtdSourceRecord[]): YtdSummary {
  const matching = records.filter(
    (record) => normalizeProduct(record.product) === normalizeProduct(product),
  );
  const collect = (pick: (record: YtdSourceRecord) => number | undefined | null) =>
    matching.map((record) => finiteOrNull(pick(record)));

  const meta = sumAvailable(collect((record) => record.meta)) ?? 0;
  const real = sumAvailable(collect((record) => record.real)) ?? 0;
  const previousReal = sumAvailable(collect((record) => record.previousReal)) ?? 0;
  const source = matching.length === 1 ? matching[0] : null;

  return {
    product,
    meta,
    real,
    previousReal,
    attainment: source
      ? finiteOrNull(source.attainment)
      : matching.length
        ? meta
          ? real / meta
          : 0
        : null,
    gap: sumAvailable(collect((record) => record.gap)),
    average: sumAvailable(collect((record) => record.average)),
    yoyGap: sumAvailable(collect((record) => record.yoyGap)),
    yoy: source
      ? finiteOrNull(source.yoy)
      : matching.length
        ? previousReal
          ? real / previousReal - 1
          : 0
        : null,
  };
}
