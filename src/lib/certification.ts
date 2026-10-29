import type { CertificationQscRow } from "../components/CertificationQscHistory.tsx";

/** Only persisted simulations are exportable; never substitute the example closed cycle. */
export function parseCertificationPreview(payload: unknown): CyclePayload | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const validRow = (value: unknown): boolean => {
    if (!value || typeof value !== "object") return false;
    const row = value as Record<string, unknown>;
    return (
      typeof row.id === "string" &&
      typeof row.indicator === "string" &&
      [...MONTH_FIELDS, "totalizer", "points", "band"].every(
        (key) => typeof row[key] === "string",
      ) &&
      MONTH_FIELDS.every((key) => {
        const text = (row[key] as string).trim();
        return (
          !text ||
          (/^[+-]?(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?$/.test(text) &&
            Number.isFinite(Number(text.replace(/\./g, "").replace(",", "."))))
        );
      })
    );
  };
  const qsc = record.qsc as Record<string, unknown> | undefined;
  if (
    !["summary", "oneShot", "ftthPhysical", "newProductsRevenue", "revenuePerFdv"].every((key) =>
      validRow(record[key]),
    ) ||
    !Array.isArray(record.breakdown) ||
    !record.breakdown.every(validRow) ||
    !qsc ||
    !Array.isArray(qsc.rows) ||
    !qsc.rows.every(validRow) ||
    typeof qsc.totalPoints !== "string"
  )
    return null;
  return withoutDuplicateLocationRow(payload as CyclePayload);
}

/** Same derived values for the editable screen and the read-only report. No persistence. */
export function calculateCertificationCycle(input: CyclePayload) {
  const cycle = withoutDuplicateLocationRow(input);
  const summary = withCalculatedSummary(cycle.summary, cycle.breakdown);
  const oneShot = withCalculatedOneShot(cycle.oneShot);
  const ftthPhysical = withCalculatedFtthPhysical(cycle.ftthPhysical);
  const newProductsRevenue = withCalculatedNewProductsRevenue(cycle.newProductsRevenue);
  const revenuePerFdv = withCalculatedRevenuePerFdv(cycle.revenuePerFdv);
  const qscRows = cycle.qsc.rows.map(withCalculatedQscRow);
  const filled = qscRows.filter((row) => row.points.trim() !== "");
  const qscPoints = filled.length
    ? filled.reduce((total, row) => total + parseCurrency(row.points), 0)
    : parseCurrency(cycle.qsc.totalPoints);
  const qscTotalPoints = filled.length ? formatCurrency(qscPoints) : cycle.qsc.totalPoints;
  const totalPoints = [summary, oneShot, ftthPhysical, newProductsRevenue, revenuePerFdv].reduce(
    (total, row) => total + parseCurrency(row.points),
    qscPoints,
  );
  const revenueTelecom = parseCurrency(summary.totalizer);
  const accumulatedRevenue = MONTH_FIELDS.reduce(
    (total, field) => total + parseCurrency(summary[field]),
    0,
  );
  return {
    summary,
    oneShot,
    ftthPhysical,
    newProductsRevenue,
    revenuePerFdv,
    qscRows,
    qscPoints,
    qscTotalPoints,
    totalPoints,
    revenueTelecom,
    stone: certificationStone(revenueTelecom, totalPoints),
    alerts: certificationAlerts(
      revenueTelecom,
      totalPoints,
      qscPoints,
      totalPoints - qscPoints,
      accumulatedRevenue,
      6,
    ),
    breakdown: cycle.breakdown.map(withCalculatedAverage),
  };
}

export type CertificationField =
  "jan" | "feb" | "mar" | "apr" | "may" | "jun" | "totalizer" | "points" | "band";

export type CertificationRow = Record<CertificationField, string> & {
  id: string;
  indicator: string;
};
export type CycleId = "previous" | "current";

export const SUMMARY_ROW: CertificationRow = {
  id: "receita-total",
  indicator: "Receita Telecom + Digital + TI + Loc de Equipamentos",
  jan: "66.971,58",
  feb: "66.867,83",
  mar: "92.079,82",
  apr: "89.902,19",
  may: "75.019,46",
  jun: "63.832,40",
  totalizer: "75.778,88",
  points: "4.400",
  band: "FAIXA 4",
};

export const ONE_SHOT_ROW: CertificationRow = {
  id: "receita-eletronicos-equipamentos-one-shot",
  indicator: "RECEITA ELETRÔNICOS / EQUIPAMENTOS / ONE SHOT",
  jan: "208.827,00",
  feb: "213.655,00",
  mar: "210.800,00",
  apr: "294.668,00",
  may: "384.528,00",
  jun: "261.681,00",
  totalizer: "262.359,83",
  points: "300",
  band: "FAIXA 3",
};

export const FTTH_PHYSICAL_ROW: CertificationRow = {
  id: "fisicos-ftth",
  indicator: "FÍSICOS FTTH",
  jan: "",
  feb: "",
  mar: "",
  apr: "",
  may: "",
  jun: "",
  totalizer: "",
  points: "0",
  band: "FAIXA 0",
};

export const NEW_PRODUCTS_REVENUE_ROW: CertificationRow = {
  id: "receita-novos-produtos",
  indicator: "RECEITA NOVOS PRODUTOS",
  jan: "",
  feb: "",
  mar: "",
  apr: "",
  may: "",
  jun: "",
  totalizer: "",
  points: "0",
  band: "FAIXA 0",
};

export const REVENUE_PER_FDV_ROW: CertificationRow = {
  id: "receita-fdv",
  indicator: "RECEITA / FDV",
  jan: "",
  feb: "",
  mar: "",
  apr: "",
  may: "",
  jun: "",
  totalizer: "",
  points: "0",
  band: "FAIXA 0",
};

export const QSC_ROWS: CertificationQscRow[] = [
  {
    id: "qsc-carteira",
    indicator: "QSC Carteira",
    accent: "text-violet-700 dark:text-violet-300",
    jan: "",
    feb: "",
    mar: "",
    apr: "",
    may: "",
    jun: "",
    totalizer: "",
    points: "",
    band: "",
  },
  {
    id: "qsc-fixa",
    indicator: "QSC Fixa",
    accent: "text-cyan-700 dark:text-cyan-300",
    jan: "",
    feb: "",
    mar: "",
    apr: "",
    may: "",
    jun: "",
    totalizer: "",
    points: "",
    band: "",
  },
  {
    id: "qsc-movel",
    indicator: "QSC Móvel",
    accent: "text-fuchsia-700 dark:text-fuchsia-300",
    jan: "",
    feb: "",
    mar: "",
    apr: "",
    may: "",
    jun: "",
    totalizer: "",
    points: "",
    band: "",
  },
];

/**
 * A locação já esteve em duas linhas ("receita-locacao", zerada, e esta). A linha que
 * guarda os valores é esta; prévias salvas com a duplicata são unificadas ao carregar.
 */
export const LOCATION_ROW_ID = "receita-locacao-mensal";
export const LEGACY_LOCATION_ROW_ID = "receita-locacao";

export const BREAKDOWN_ROWS: CertificationRow[] = [
  {
    id: "receita-movel",
    indicator: "Receita - Móvel",
    jan: "52.057,47",
    feb: "45.918,49",
    mar: "56.913,65",
    apr: "60.613,36",
    may: "50.620,38",
    jun: "45.043,78",
    totalizer: "51.861,19",
    points: "",
    band: "",
  },
  {
    id: "receita-fixa-basica",
    indicator: "Receita - Fixa Básica",
    jan: "11.230,89",
    feb: "11.975,83",
    mar: "14.409,67",
    apr: "15.368,53",
    may: "14.337,59",
    jun: "13.684,76",
    totalizer: "13.501,21",
    points: "",
    band: "",
  },
  {
    id: "receita-fixa-avancada",
    indicator: "Receita - Fixa Avançada",
    jan: "3.204,02",
    feb: "8.615,01",
    mar: "20.276,00",
    apr: "13.331,30",
    may: "7.263,81",
    jun: "4.612,36",
    totalizer: "9.550,42",
    points: "",
    band: "",
  },
  {
    id: "receita-digital-ti",
    indicator: "Receita - Digital e TI",
    jan: "479,20",
    feb: "358,50",
    mar: "480,50",
    apr: "589,00",
    may: "2.209,70",
    jun: "491,50",
    totalizer: "768,07",
    points: "",
    band: "",
  },
  {
    id: LOCATION_ROW_ID,
    indicator: "Receita - Loc de Equipamentos",
    jan: "0,00",
    feb: "0,00",
    mar: "0,00",
    apr: "0,00",
    may: "587,98",
    jun: "0,00",
    totalizer: "98,00",
    points: "",
    band: "",
  },
];

export const blankCycleRow = (row: CertificationRow): CertificationRow => ({
  ...row,
  jan: "",
  feb: "",
  mar: "",
  apr: "",
  may: "",
  jun: "",
  totalizer: "",
  points: "",
  band: "",
});

export const INITIAL_CYCLES: Record<
  CycleId,
  {
    summary: CertificationRow;
    breakdown: CertificationRow[];
    oneShot: CertificationRow;
    ftthPhysical: CertificationRow;
    newProductsRevenue: CertificationRow;
    revenuePerFdv: CertificationRow;
    qsc: { totalPoints: string; rows: CertificationQscRow[] };
  }
> = {
  previous: {
    summary: SUMMARY_ROW,
    breakdown: BREAKDOWN_ROWS,
    oneShot: ONE_SHOT_ROW,
    ftthPhysical: FTTH_PHYSICAL_ROW,
    newProductsRevenue: NEW_PRODUCTS_REVENUE_ROW,
    revenuePerFdv: REVENUE_PER_FDV_ROW,
    qsc: { totalPoints: "0", rows: QSC_ROWS },
  },
  current: {
    summary: blankCycleRow(SUMMARY_ROW),
    breakdown: BREAKDOWN_ROWS.map(blankCycleRow),
    oneShot: blankCycleRow(ONE_SHOT_ROW),
    ftthPhysical: blankCycleRow(FTTH_PHYSICAL_ROW),
    newProductsRevenue: blankCycleRow(NEW_PRODUCTS_REVENUE_ROW),
    revenuePerFdv: blankCycleRow(REVENUE_PER_FDV_ROW),
    qsc: {
      totalPoints: "0",
      rows: QSC_ROWS.map((row) => ({ ...row })),
    },
  },
};

export const MONTH_COLUMNS: Record<CycleId, Array<{ field: CertificationField; label: string }>> = {
  previous: [
    { field: "jan", label: "Jan" },
    { field: "feb", label: "Fev" },
    { field: "mar", label: "Mar" },
    { field: "apr", label: "Abr" },
    { field: "may", label: "Mai" },
    { field: "jun", label: "Jun" },
  ],
  current: [
    { field: "jan", label: "Jul" },
    { field: "feb", label: "Ago" },
    { field: "mar", label: "Set" },
    { field: "apr", label: "Out" },
    { field: "may", label: "Nov" },
    { field: "jun", label: "Dez" },
  ],
};

export type CertificationColumn = {
  field: CertificationField;
  label: string;
  width: string;
  align: "numeric" | "state";
};

export const BASE_COLUMNS: CertificationColumn[] = [
  // Largura dimensionada pelo conteudo financeiro: o totalizador precisa exibir
  // valores com centavos por inteiro e a Faixa nao pode ficar fora da area util.
  { field: "totalizer", label: "Totalizador", width: "w-[168px]", align: "numeric" },
  { field: "points", label: "Pts", width: "w-[112px]", align: "numeric" },
  { field: "band", label: "Faixa", width: "w-[132px]", align: "state" },
];

export const SUM_FIELDS = ["jan", "feb", "mar", "apr", "may", "jun", "totalizer"] as const;
export const MONTH_FIELDS = ["jan", "feb", "mar", "apr", "may", "jun"] as const;
export const SUMMARY_CALCULATED_FIELDS = [...SUM_FIELDS, "points", "band"] as const;
export const REVENUE_SCORE_RULES = [
  { minimum: 80_000, band: "FAIXA 5", points: "6.500" },
  { minimum: 64_000, band: "FAIXA 4", points: "5.200" },
  { minimum: 48_000, band: "FAIXA 3", points: "3.900" },
  { minimum: 32_000, band: "FAIXA 2", points: "2.600" },
  { minimum: 16_000, band: "FAIXA 1", points: "1.300" },
] as const;
export const ONE_SHOT_SCORE_RULES = [
  { minimum: 408_000, band: "FAIXA 5", points: "500" },
  { minimum: 300_000, band: "FAIXA 4", points: "400" },
  { minimum: 204_000, band: "FAIXA 3", points: "300" },
  { minimum: 120_000, band: "FAIXA 2", points: "200" },
  { minimum: 60_000, band: "FAIXA 1", points: "100" },
] as const;
export const FTTH_PHYSICAL_SCORE_RULES = [
  { minimum: 240, band: "FAIXA 5", points: "1.000" },
  { minimum: 120, band: "FAIXA 4", points: "800" },
  { minimum: 60, band: "FAIXA 3", points: "600" },
  { minimum: 45, band: "FAIXA 2", points: "400" },
  { minimum: 35, band: "FAIXA 1", points: "200" },
] as const;
export const NEW_PRODUCTS_REVENUE_SCORE_RULES = [
  { minimum: 14_000, band: "FAIXA 5", points: "500" },
  { minimum: 11_200, band: "FAIXA 4", points: "400" },
  { minimum: 8_400, band: "FAIXA 3", points: "300" },
  { minimum: 5_600, band: "FAIXA 2", points: "200" },
  { minimum: 2_800, band: "FAIXA 1", points: "100" },
] as const;
export const REVENUE_PER_FDV_SCORE_RULES = [
  { minimum: 1_500, band: "FAIXA 5", points: "500" },
  { minimum: 1_200, band: "FAIXA 4", points: "400" },
  { minimum: 900, band: "FAIXA 3", points: "300" },
  { minimum: 600, band: "FAIXA 2", points: "200" },
  { minimum: 300, band: "FAIXA 1", points: "100" },
] as const;
export const CERTIFICATION_STONES = [
  { stone: "V", minimumRevenue: 200_000, minimumPoints: 10_800, bonus: "12,5%" },
  { stone: "PLATINUM", minimumRevenue: 100_000, minimumPoints: 9_600, bonus: "10,0%" },
  { stone: "DIAMANTE", minimumRevenue: 65_000, minimumPoints: 7_800, bonus: "7,5%" },
  { stone: "OURO", minimumRevenue: 40_000, minimumPoints: 6_000, bonus: "5,0%" },
  { stone: "PRATA", minimumRevenue: 0, minimumPoints: 4_200, bonus: "2,5%" },
  { stone: "BRONZE", minimumRevenue: 0, minimumPoints: 1_500, bonus: "—" },
  { stone: "NÃO CERTIFICADO", minimumRevenue: 0, minimumPoints: 0, bonus: "—" },
] as const;

export const isSumField = (field: CertificationField): field is (typeof SUM_FIELDS)[number] =>
  SUM_FIELDS.includes(field as (typeof SUM_FIELDS)[number]);

export const isCalculatedSummaryField = (field: CertificationField) =>
  SUMMARY_CALCULATED_FIELDS.includes(field as (typeof SUMMARY_CALCULATED_FIELDS)[number]);

export const parseCurrency = (value: string) => {
  const parsed = Number(value.trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    value,
  );

/**
 * A Certificação usa a mesma escala da tabela histórica do QSC: cada mês é a
 * soma das notas dos indicadores do domínio; o totalizador é a média dos meses
 * preenchidos e a pontuação vem da faixa desse totalizador.
 */
export const QSC_TOTAL_SCORE_RULES = [
  { minimum: 90, band: "FAIXA 5", points: "1.000" },
  { minimum: 80, band: "FAIXA 4", points: "800" },
  { minimum: 70, band: "FAIXA 3", points: "600" },
  { minimum: 60, band: "FAIXA 2", points: "400" },
  { minimum: 50, band: "FAIXA 1", points: "200" },
] as const;

export function withCalculatedSummary(summary: CertificationRow, breakdown: CertificationRow[]) {
  const values = Object.fromEntries(
    MONTH_FIELDS.map((field) => {
      const filledValues = breakdown
        .map((row) => row[field])
        .filter((value) => value.trim() !== "");
      return [
        field,
        filledValues.length
          ? formatCurrency(filledValues.reduce((total, value) => total + parseCurrency(value), 0))
          : "",
      ];
    }),
  ) as Pick<CertificationRow, (typeof MONTH_FIELDS)[number]>;
  const monthlyTotals = MONTH_FIELDS.map((field) => values[field])
    .filter((value) => value.trim() !== "")
    .map(parseCurrency);
  const totalizer = monthlyTotals.length
    ? monthlyTotals.reduce((total, value) => total + value, 0) / monthlyTotals.length
    : 0;
  const score = REVENUE_SCORE_RULES.find((rule) => totalizer >= rule.minimum);

  return {
    ...summary,
    ...values,
    totalizer: monthlyTotals.length ? formatCurrency(totalizer) : "",
    points: score?.points ?? "0",
    band: score?.band ?? "FAIXA 0",
  };
}

export function withCalculatedAverage(row: CertificationRow) {
  const monthValues = MONTH_FIELDS.map((field) => row[field]).filter(
    (value) => value.trim() !== "",
  );
  const totalizer = monthValues.length
    ? monthValues.reduce((total, value) => total + parseCurrency(value), 0) / monthValues.length
    : 0;
  return { ...row, totalizer: monthValues.length ? formatCurrency(totalizer) : "" };
}

export function withCalculatedQscRow(row: CertificationQscRow) {
  const monthValues = MONTH_FIELDS.map((field) => row[field])
    .filter((value) => value.trim() !== "")
    .map(parseCurrency);
  const totalizer = monthValues.length
    ? Math.round(monthValues.reduce((total, value) => total + value, 0) / monthValues.length)
    : null;
  const score =
    totalizer === null
      ? undefined
      : QSC_TOTAL_SCORE_RULES.find((rule) => totalizer >= rule.minimum);

  return {
    ...row,
    totalizer: totalizer === null ? "" : String(totalizer),
    points: totalizer === null ? "" : (score?.points ?? "0"),
    band: totalizer === null ? "" : (score?.band ?? "FAIXA 0"),
  };
}

export function withCalculatedOneShot(row: CertificationRow) {
  const monthValues = MONTH_COLUMNS.previous
    .map((column) => row[column.field])
    .filter((value) => value.trim() !== "");
  const totalizer = monthValues.length
    ? monthValues.reduce((total, value) => total + parseCurrency(value), 0) / monthValues.length
    : 0;
  const score = ONE_SHOT_SCORE_RULES.find((rule) => totalizer >= rule.minimum);

  return {
    ...row,
    totalizer: monthValues.length ? formatCurrency(totalizer) : "",
    points: score?.points ?? "0",
    band: score?.band ?? "FAIXA 0",
  };
}

export function withCalculatedFtthPhysical(row: CertificationRow) {
  const monthValues = MONTH_COLUMNS.previous
    .map((column) => row[column.field])
    .filter((value) => value.trim() !== "");
  const totalizer = monthValues.length
    ? monthValues.reduce((total, value) => total + parseCurrency(value), 0) / monthValues.length
    : 0;
  const score = FTTH_PHYSICAL_SCORE_RULES.find((rule) => totalizer >= rule.minimum);

  return {
    ...row,
    totalizer: monthValues.length ? String(Math.round(totalizer)) : "",
    points: score?.points ?? "0",
    band: score?.band ?? "FAIXA 0",
  };
}

export function withCalculatedNewProductsRevenue(row: CertificationRow) {
  const monthValues = MONTH_COLUMNS.previous
    .map((column) => row[column.field])
    .filter((value) => value.trim() !== "");
  const totalizer = monthValues.length
    ? monthValues.reduce((total, value) => total + parseCurrency(value), 0) / monthValues.length
    : 0;
  const score = NEW_PRODUCTS_REVENUE_SCORE_RULES.find((rule) => totalizer >= rule.minimum);

  return {
    ...row,
    totalizer: monthValues.length ? formatCurrency(totalizer) : "",
    points: score?.points ?? "0",
    band: score?.band ?? "FAIXA 0",
  };
}

export function withCalculatedRevenuePerFdv(row: CertificationRow) {
  const monthValues = MONTH_COLUMNS.previous
    .map((column) => row[column.field])
    .filter((value) => value.trim() !== "");
  const totalizer = monthValues.length
    ? monthValues.reduce((total, value) => total + parseCurrency(value), 0) / monthValues.length
    : 0;
  const score = REVENUE_PER_FDV_SCORE_RULES.find((rule) => totalizer >= rule.minimum);

  return {
    ...row,
    totalizer: monthValues.length ? formatCurrency(totalizer) : "",
    points: score?.points ?? "0",
    band: score?.band ?? "FAIXA 0",
  };
}

export function certificationStone(revenueTelecom: number, totalPoints: number) {
  return (
    CERTIFICATION_STONES.find(
      (stone) => revenueTelecom >= stone.minimumRevenue && totalPoints >= stone.minimumPoints,
    ) ?? CERTIFICATION_STONES[CERTIFICATION_STONES.length - 1]
  );
}

export type CertificationAlert =
  | {
      kind: "revenue-gap";
      stone: (typeof CERTIFICATION_STONES)[number];
      /** Quanto falta na média mensal de receita. */
      gap: number;
      /** Quanto falta na receita total do ciclo para a média exigida (meses do ciclo × mínimo). */
      totalGap: number;
      requiredTotal: number;
      accumulated: number;
    }
  | {
      kind: "qsc-gap";
      stone: (typeof CERTIFICATION_STONES)[number];
      gap: number;
      requiredQscPoints: number;
    };

export function certificationAlerts(
  revenueTelecom: number,
  totalPoints: number,
  qscPoints: number,
  nonQscPoints: number,
  accumulatedRevenue: number,
  cycleMonths: number,
): CertificationAlert[] {
  const eligibleStones = CERTIFICATION_STONES.filter((stone) => stone.stone !== "NÃO CERTIFICADO");
  const byPoints = eligibleStones.find((stone) => totalPoints >= stone.minimumPoints);
  const byRevenue = eligibleStones.find(
    (stone) => stone.minimumRevenue > 0 && revenueTelecom >= stone.minimumRevenue,
  );
  const alerts: CertificationAlert[] = [];

  if (byPoints && revenueTelecom < byPoints.minimumRevenue) {
    const requiredTotal = byPoints.minimumRevenue * cycleMonths;
    alerts.push({
      kind: "revenue-gap",
      stone: byPoints,
      gap: byPoints.minimumRevenue - revenueTelecom,
      totalGap: Math.max(0, requiredTotal - accumulatedRevenue),
      requiredTotal,
      accumulated: accumulatedRevenue,
    });
  }

  if (byRevenue) {
    const requiredQscPoints = Math.max(0, byRevenue.minimumPoints - nonQscPoints);
    if (qscPoints < requiredQscPoints) {
      alerts.push({
        kind: "qsc-gap",
        stone: byRevenue,
        gap: requiredQscPoints - qscPoints,
        requiredQscPoints,
      });
    }
  }

  return alerts;
}

export type CyclePayload = (typeof INITIAL_CYCLES)["current"];

/**
 * Prévias salvas antes da correção trazem a locação em duas linhas. Unifica na linha
 * canônica somando os meses preenchidos, o que preserva o total da receita.
 */
export function withoutDuplicateLocationRow(payload: CyclePayload): CyclePayload {
  const rows = Array.isArray(payload.breakdown) ? payload.breakdown : [];
  const canonicalLabel = BREAKDOWN_ROWS.find((row) => row.id === LOCATION_ROW_ID)!.indicator;
  const legacy = rows.find((row) => row.id === LEGACY_LOCATION_ROW_ID);
  if (!legacy)
    return {
      ...payload,
      breakdown: rows.map((row) =>
        row.id === LOCATION_ROW_ID ? { ...row, indicator: canonicalLabel } : row,
      ),
    };
  const kept = rows.filter((row) => row.id !== LEGACY_LOCATION_ROW_ID);
  const current = kept.find((row) => row.id === LOCATION_ROW_ID);
  const merged: CertificationRow = { ...(current ?? legacy), id: LOCATION_ROW_ID };
  for (const field of MONTH_FIELDS) {
    const values = [current?.[field] ?? "", legacy[field]].filter((value) => value.trim() !== "");
    merged[field] = values.length
      ? formatCurrency(values.reduce((total, value) => total + parseCurrency(value), 0))
      : "";
  }
  merged.indicator = canonicalLabel;
  return {
    ...payload,
    breakdown: current
      ? kept.map((row) => (row.id === LOCATION_ROW_ID ? merged : row))
      : [...kept, merged],
  };
}
