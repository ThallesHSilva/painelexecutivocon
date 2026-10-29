import type { QscMetricPoint, QscMetricSeries } from "./qsc.ts";

/**
 * Variação de um indicador do QSC entre o seu mês fechado (a competência mais recente
 * com apuração) e o mês imediatamente anterior.
 *
 * - `worse`: piorou, isto é, andou contra o sentido favorável do indicador. Para um
 *   indicador em que subir é bom, é uma queda do valor; para churn e afins, em que
 *   descer é bom, é uma alta do valor.
 * - `unavailable`: falta o mês fechado ou o mês anterior (ou algum dos dois não tem
 *   apuração). Ausência de dado nunca vira queda nem estabilidade.
 */
export type QscVariationStatus = "worse" | "better" | "stable" | "unavailable";

export type QscVariation = {
  status: QscVariationStatus;
  current: QscMetricPoint | null;
  previous: QscMetricPoint | null;
  /** Variação em pontos percentuais, `atual − anterior`, a partir dos valores exibidos. */
  deltaPp: number | null;
};

export function previousCompetence(competence: string) {
  const [year, month] = competence.split("-").map(Number);
  if (!year || !month) return null;
  const date = new Date(Date.UTC(year, month - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Valor com a mesma precisão exibida (4 casas na fração), em inteiros para não somar ruído. */
const displayedBasisPoints = (value: number) => Math.trunc(value * 10_000);

function usable(point: QscMetricPoint | null | undefined): point is QscMetricPoint & {
  value: number;
} {
  return !!point && point.available && point.value !== null && Number.isFinite(point.value);
}

/**
 * Mês fechado de um indicador: a competência mais recente com apuração. Vários
 * indicadores (early churn, TFP, saldo de portabilidade…) fecham com defasagem e ainda
 * não têm o mês corrente da base; nesse caso o fechado é o mês anterior a ele.
 */
export function qscClosedPoint(metric: QscMetricSeries) {
  const points = [...metric.history, ...(metric.latest ? [metric.latest] : [])];
  return (
    points
      .filter(usable)
      .sort((a, b) => b.competence.localeCompare(a.competence))
      .at(0) ?? null
  );
}

export function qscVariation(metric: QscMetricSeries): QscVariation {
  const current = qscClosedPoint(metric);
  const previousMonth = current ? previousCompetence(current.competence) : null;
  const previous = previousMonth
    ? (metric.history.find((point) => point.competence === previousMonth) ?? null)
    : null;
  if (!usable(current) || !usable(previous))
    return { status: "unavailable", current, previous, deltaPp: null };
  const delta = displayedBasisPoints(current.value) - displayedBasisPoints(previous.value);
  const deltaPp = delta / 100;
  if (delta === 0) return { status: "stable", current, previous, deltaPp };
  const improved = metric.favorableDirection === "up" ? delta > 0 : delta < 0;
  return { status: improved ? "better" : "worse", current, previous, deltaPp };
}

/** Indicadores que pioraram, do maior recuo para o menor. */
export function qscWorsened(metrics: QscMetricSeries[]) {
  return metrics
    .map((metric) => ({ metric, variation: qscVariation(metric) }))
    .filter((item) => item.variation.status === "worse")
    .sort(
      (a, b) =>
        Math.abs(b.variation.deltaPp ?? 0) - Math.abs(a.variation.deltaPp ?? 0) ||
        a.metric.label.localeCompare(b.metric.label, "pt-BR"),
    );
}

/** "2026-08" -> "ago/26". */
export function shortCompetence(competence: string) {
  const [year, month] = competence.split("-").map(Number);
  if (!year || !month) return "—";
  const name = new Intl.DateTimeFormat("pt-BR", { month: "short", timeZone: "UTC" })
    .format(new Date(Date.UTC(year, month - 1, 1)))
    .replace(".", "");
  return `${name}/${String(year).slice(2)}`;
}

/** Texto da variação: sinal explícito, vírgula decimal, sempre com "p.p.". */
export function formatQscDeltaPp(deltaPp: number | null) {
  if (deltaPp === null) return "—";
  const text = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  }).format(deltaPp);
  return `${text} p.p.`;
}
