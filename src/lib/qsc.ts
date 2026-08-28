export type QscDomain = "carteira" | "fixa" | "movel";

export interface QscScoreRule {
  start: number;
  end: number;
  score: number;
  band: string;
}

export interface QscMetricPoint {
  competence: string;
  value: number | null;
  numerator: number;
  denominator: number;
  available: boolean;
  zeroPark: boolean;
  score: number | null;
  scoreBand: string | null;
}

export interface QscMetricSeries {
  id: string;
  domain: QscDomain;
  label: string;
  formula: string;
  interpretation: string;
  favorableDirection: "up" | "down";
  scoreRules: QscScoreRule[];
  latest: QscMetricPoint | null;
  history: QscMetricPoint[];
}

export interface QscApiResponse {
  competence: string;
  available: boolean;
  calculatedAt: string;
  updateFrequency: string;
  rows: number;
  partners: Array<{ id: string; name: string; document?: string }>;
  metrics: QscMetricSeries[];
}
