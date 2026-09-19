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
