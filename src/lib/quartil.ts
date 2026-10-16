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
