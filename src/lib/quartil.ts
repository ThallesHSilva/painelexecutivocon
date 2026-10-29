export type QuartilMetric = "receita" | "movel" | "ftth";
export type QuartilPoint = {
  id: string;
  name: string;
  partnerId: string;
  partnerName: string;
  month: string;
  tenure: "experienced" | "new" | null;
  values: Record<QuartilMetric, number | null>;
  quartiles: Record<QuartilMetric, number | null>;
};
export type QuartilConsultant = QuartilPoint & {
  history: QuartilPoint[];
  comparisons: Record<"3" | "6", { month: string; changes: Record<QuartilMetric, number | null> }>;
};
export type QuartilSnapshot = {
  source: { report: string; importedAt: string };
  latestMonth: string;
  months: string[];
  partners: { id: string; name: string }[];
  consultants: QuartilConsultant[];
  warnings: string[];
};

/**
 * Limites mínimos (inclusivos) de Q1 a Q4; abaixo do último limite é Q5.
 * Espelha QUARTIL_RULES de scripts/quartil.mjs, que calcula as faixas na importação —
 * o teste scripts/quartil.test.mjs garante que os dois não divergem.
 * Em "new", receita Q4 começa em qualquer valor acima de zero.
 */
export const QUARTIL_BOUNDS = {
  experienced: { receita: [2000, 1500, 1000, 500], movel: [21, 16, 11, 6], ftth: [15, 10, 6, 3] },
  new: { receita: [500, 251, 100, 0.01], movel: [16, 11, 6, 1], ftth: [10, 6, 3, 1] },
} as const;

/** Texto da faixa de um quartil (1 a 5) a partir dos limites do indicador. */
export function quartilRangeLabel(
  metric: QuartilMetric,
  tenure: "experienced" | "new",
  quartile: number,
) {
  const bounds = QUARTIL_BOUNDS[tenure][metric];
  const money = metric === "receita";
  const format = (value: number) =>
    money
      ? value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : value.toLocaleString("pt-BR");
  const below = (value: number) =>
    format(money ? Math.round((value - 0.01) * 100) / 100 : value - 1);
  if (quartile === 1) return `${format(bounds[0])} ou mais`;
  if (quartile === 5) {
    const limit = bounds[3];
    return limit <= 0.01 && money ? format(0) : `até ${below(limit)}`;
  }
  const lower = bounds[quartile - 1];
  const upper = bounds[quartile - 2];
  const from = money && lower <= 0.01 ? "acima de R$ 0,00" : format(lower);
  return money && lower <= 0.01 ? `${from} até ${below(upper)}` : `${from} a ${below(upper)}`;
}

function previousMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return null;
  const date = new Date(Date.UTC(year, monthNumber - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Conta competências consecutivas em Q5, interrompendo em lacunas ou mudança de quartil. */
export function quartilQ5Streak(consultant: QuartilConsultant, metric: QuartilMetric) {
  const history = new Map(consultant.history.map((point) => [point.month, point]));
  let month: string | null = consultant.month;
  let streak = 0;
  while (month) {
    const point = history.get(month);
    if (!point || point.quartiles[metric] !== 5) break;
    streak += 1;
    month = previousMonth(month);
  }
  return streak;
}

/** Novos consultores entram em alerta na primeira competência em Q5. */
export function isQuartilAlert(consultant: QuartilConsultant, metric: QuartilMetric) {
  const minimumMonths = consultant.tenure === "new" ? 1 : 3;
  return quartilQ5Streak(consultant, metric) >= minimumMonths;
}

/**
 * Contagem dos cards "Evolução em 3/6 meses": evoluiu (subiu faixa), regrediu (caiu),
 * neutro (variação 0) e alerta. Consultor sem histórico comparável fica fora dos três
 * primeiros, mas ainda pode estar em alerta.
 */
export function quartilEvolutionCounts(
  consultants: QuartilConsultant[],
  metric: QuartilMetric,
  period: "3" | "6",
) {
  let up = 0;
  let down = 0;
  let stable = 0;
  for (const consultant of consultants) {
    const change = consultant.comparisons[period].changes[metric];
    if (change === null) continue;
    if (change > 0) up += 1;
    else if (change < 0) down += 1;
    else stable += 1;
  }
  const alert = consultants.filter((consultant) => isQuartilAlert(consultant, metric)).length;
  return { up, down, stable, alert };
}
