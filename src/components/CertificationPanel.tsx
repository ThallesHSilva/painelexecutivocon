import { useEffect, useMemo, useState } from "react";
import { Award, ChevronDown, ExternalLink, LoaderCircle, Save } from "lucide-react";
import {
  CertificationQscHistory,
  type CertificationQscField,
  type CertificationQscRow,
} from "@/components/CertificationQscHistory";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePartnerFilter } from "@/contexts/AppContexts";
import { usePartners } from "@/hooks/useData";
import { fmtInt } from "@/lib/format";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CertificationField =
  "jan" | "feb" | "mar" | "apr" | "may" | "jun" | "totalizer" | "points" | "band";

type CertificationRow = Record<CertificationField, string> & { id: string; indicator: string };
type CycleId = "previous" | "current";

const CERTIFICATION_POWER_BI_URL =
  "https://app.powerbi.com/groups/me/reports/6cb65a90-4ea5-4917-8f89-2c588ac43942/d3cdc620745abb5b4843?ctid=9744600e-3e04-492e-baa1-25ec245c6f10&openReportSource=ReportInvitation&experience=power-bi";

const SUMMARY_ROW: CertificationRow = {
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

const ONE_SHOT_ROW: CertificationRow = {
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

const FTTH_PHYSICAL_ROW: CertificationRow = {
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

const NEW_PRODUCTS_REVENUE_ROW: CertificationRow = {
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

const REVENUE_PER_FDV_ROW: CertificationRow = {
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

const QSC_ROWS: CertificationQscRow[] = [
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

const BREAKDOWN_ROWS: CertificationRow[] = [
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
    id: "receita-locacao",
    indicator: "Receita - Loc de Equipamentos",
    jan: "0,00",
    feb: "0,00",
    mar: "0,00",
    apr: "0,00",
    may: "0,00",
    jun: "0,00",
    totalizer: "0,00",
    points: "",
    band: "",
  },
  {
    id: "receita-locacao-mensal",
    indicator: "RECEITA LOC DE EQUIPAMENTOS",
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

const blankCycleRow = (row: CertificationRow): CertificationRow => ({
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

const INITIAL_CYCLES: Record<
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

const MONTH_COLUMNS: Record<CycleId, Array<{ field: CertificationField; label: string }>> = {
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

const BASE_COLUMNS: Array<{
  field: CertificationField;
  label: string;
  width: string;
  numeric?: boolean;
}> = [
  { field: "totalizer", label: "Totalizador", width: "w-[130px]", numeric: true },
  { field: "points", label: "Pts", width: "w-[100px]", numeric: true },
  { field: "band", label: "Faixa", width: "w-[120px]" },
];

const SUM_FIELDS = ["jan", "feb", "mar", "apr", "may", "jun", "totalizer"] as const;
const SUMMARY_CALCULATED_FIELDS = [...SUM_FIELDS, "points", "band"] as const;
const REVENUE_SCORE_RULES = [
  { minimum: 80_000, band: "FAIXA 5", points: "6.500" },
  { minimum: 64_000, band: "FAIXA 4", points: "5.200" },
  { minimum: 48_000, band: "FAIXA 3", points: "3.900" },
  { minimum: 32_000, band: "FAIXA 2", points: "2.600" },
  { minimum: 16_000, band: "FAIXA 1", points: "1.300" },
] as const;
const ONE_SHOT_SCORE_RULES = [
  { minimum: 408_000, band: "FAIXA 5", points: "500" },
  { minimum: 300_000, band: "FAIXA 4", points: "400" },
  { minimum: 204_000, band: "FAIXA 3", points: "300" },
  { minimum: 120_000, band: "FAIXA 2", points: "200" },
  { minimum: 60_000, band: "FAIXA 1", points: "100" },
] as const;
const FTTH_PHYSICAL_SCORE_RULES = [
  { minimum: 240, band: "FAIXA 5", points: "1.000" },
  { minimum: 120, band: "FAIXA 4", points: "800" },
  { minimum: 60, band: "FAIXA 3", points: "600" },
  { minimum: 45, band: "FAIXA 2", points: "400" },
  { minimum: 35, band: "FAIXA 1", points: "200" },
] as const;
const NEW_PRODUCTS_REVENUE_SCORE_RULES = [
  { minimum: 14_000, band: "FAIXA 5", points: "500" },
  { minimum: 11_200, band: "FAIXA 4", points: "400" },
  { minimum: 8_400, band: "FAIXA 3", points: "300" },
  { minimum: 5_600, band: "FAIXA 2", points: "200" },
  { minimum: 2_800, band: "FAIXA 1", points: "100" },
] as const;
const REVENUE_PER_FDV_SCORE_RULES = [
  { minimum: 1_500, band: "FAIXA 5", points: "500" },
  { minimum: 1_200, band: "FAIXA 4", points: "400" },
  { minimum: 900, band: "FAIXA 3", points: "300" },
  { minimum: 600, band: "FAIXA 2", points: "200" },
  { minimum: 300, band: "FAIXA 1", points: "100" },
] as const;
const CERTIFICATION_STONES = [
  { stone: "V", minimumRevenue: 200_000, minimumPoints: 10_800, bonus: "12,5%" },
  { stone: "PLATINUM", minimumRevenue: 100_000, minimumPoints: 9_600, bonus: "10,0%" },
  { stone: "DIAMANTE", minimumRevenue: 65_000, minimumPoints: 7_800, bonus: "7,5%" },
  { stone: "OURO", minimumRevenue: 40_000, minimumPoints: 6_000, bonus: "5,0%" },
  { stone: "PRATA", minimumRevenue: 0, minimumPoints: 4_200, bonus: "2,5%" },
  { stone: "BRONZE", minimumRevenue: 0, minimumPoints: 1_500, bonus: "—" },
  { stone: "NÃO CERTIFICADO", minimumRevenue: 0, minimumPoints: 0, bonus: "—" },
] as const;

const isSumField = (field: CertificationField): field is (typeof SUM_FIELDS)[number] =>
  SUM_FIELDS.includes(field as (typeof SUM_FIELDS)[number]);

const isCalculatedSummaryField = (field: CertificationField) =>
  SUMMARY_CALCULATED_FIELDS.includes(field as (typeof SUMMARY_CALCULATED_FIELDS)[number]);

const parseCurrency = (value: string) => {
  const parsed = Number(value.trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(
    value,
  );

function withCalculatedSummary(summary: CertificationRow, breakdown: CertificationRow[]) {
  const values = Object.fromEntries(
    SUM_FIELDS.map((field) => {
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
  ) as Pick<CertificationRow, (typeof SUM_FIELDS)[number]>;
  const totalizer = values.totalizer ? parseCurrency(values.totalizer) : 0;
  const score = REVENUE_SCORE_RULES.find((rule) => totalizer >= rule.minimum);

  return {
    ...summary,
    ...values,
    points: score?.points ?? "0",
    band: score?.band ?? "FAIXA 0",
  };
}

function withCalculatedOneShot(row: CertificationRow) {
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

function withCalculatedFtthPhysical(row: CertificationRow) {
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

function withCalculatedNewProductsRevenue(row: CertificationRow) {
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

function withCalculatedRevenuePerFdv(row: CertificationRow) {
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

function certificationStone(revenueTelecom: number, totalPoints: number) {
  return (
    CERTIFICATION_STONES.find(
      (stone) => revenueTelecom >= stone.minimumRevenue && totalPoints >= stone.minimumPoints,
    ) ?? CERTIFICATION_STONES[CERTIFICATION_STONES.length - 1]
  );
}

export function CertificationPanel() {
  const [cycles, setCycles] = useState(INITIAL_CYCLES);
  const [view, setView] = useState<"previous" | "current" | "pbi">("previous");
  const [expanded, setExpanded] = useState<Record<CycleId, boolean>>({
    previous: false,
    current: false,
  });
  const [saving, setSaving] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const { effectiveSelected } = usePartnerFilter();
  const { data: partners = [] } = usePartners();
  const activePartnerId = effectiveSelected.length === 1 ? effectiveSelected[0] : null;
  const activePartner = useMemo(
    () => partners.find((partner) => partner.id === activePartnerId) ?? null,
    [activePartnerId, partners],
  );

  useEffect(() => {
    if (!activePartnerId) {
      setCycles((current) => ({ ...current, current: INITIAL_CYCLES.current }));
      return;
    }

    let cancelled = false;
    setLoadingPreview(true);
    void fetch(`/api/certificacao/previa?partnerId=${encodeURIComponent(activePartnerId)}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar a prévia deste PV.");
        return response.json() as Promise<{ preview?: { payload?: unknown } | null }>;
      })
      .then((payload) => {
        if (cancelled) return;
        const preview = payload.preview?.payload;
        const hasExpectedShape =
          preview &&
          typeof preview === "object" &&
          "summary" in preview &&
          "breakdown" in preview &&
          "qsc" in preview;
        setCycles((current) => ({
          ...current,
          current: hasExpectedShape
            ? (preview as (typeof INITIAL_CYCLES)["current"])
            : INITIAL_CYCLES.current,
        }));
      })
      .catch((error: Error) => {
        if (!cancelled) toast.error(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activePartnerId]);

  const savePreview = async () => {
    if (!activePartnerId || saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/certificacao/previa", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId: activePartnerId, payload: cycles.current }),
      });
      const payload = (await response.json()) as { message?: string };
      if (!response.ok) throw new Error(payload.message ?? "Não foi possível salvar a prévia.");
      toast.success(`Prévia de ${activePartner?.name ?? "PV"} salva com sucesso.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a prévia.");
    } finally {
      setSaving(false);
    }
  };

  const updateValue = (cycle: CycleId, rowId: string, field: CertificationField, value: string) => {
    if (cycle !== "current" || !activePartnerId) return;
    const activeCycle = cycles[cycle];
    if (
      (rowId === activeCycle.summary.id && isCalculatedSummaryField(field)) ||
      ([
        activeCycle.oneShot.id,
        activeCycle.ftthPhysical.id,
        activeCycle.newProductsRevenue.id,
        activeCycle.revenuePerFdv.id,
      ].includes(rowId) &&
        ["totalizer", "points", "band"].includes(field))
    )
      return;
    setCycles((current) => ({
      ...current,
      [cycle]: {
        summary:
          rowId === current[cycle].summary.id
            ? { ...current[cycle].summary, [field]: value }
            : current[cycle].summary,
        oneShot:
          rowId === current[cycle].oneShot.id
            ? { ...current[cycle].oneShot, [field]: value }
            : current[cycle].oneShot,
        ftthPhysical:
          rowId === current[cycle].ftthPhysical.id
            ? { ...current[cycle].ftthPhysical, [field]: value }
            : current[cycle].ftthPhysical,
        newProductsRevenue:
          rowId === current[cycle].newProductsRevenue.id
            ? { ...current[cycle].newProductsRevenue, [field]: value }
            : current[cycle].newProductsRevenue,
        revenuePerFdv:
          rowId === current[cycle].revenuePerFdv.id
            ? { ...current[cycle].revenuePerFdv, [field]: value }
            : current[cycle].revenuePerFdv,
        breakdown: current[cycle].breakdown.map((row) =>
          row.id === rowId ? { ...row, [field]: value } : row,
        ),
        qsc: current[cycle].qsc,
      },
    }));
  };

  const updateQscValue = (
    cycle: CycleId,
    rowId: string,
    field: CertificationQscField,
    value: string,
  ) => {
    if (cycle !== "current" || !activePartnerId) return;
    setCycles((current) => ({
      ...current,
      [cycle]: {
        ...current[cycle],
        qsc:
          rowId === "qsc-total"
            ? { ...current[cycle].qsc, totalPoints: value }
            : {
                ...current[cycle].qsc,
                rows: current[cycle].qsc.rows.map((row) =>
                  row.id === rowId ? { ...row, [field]: value } : row,
                ),
              },
      },
    }));
  };

  const valueCell = (
    cycle: CycleId,
    row: CertificationRow,
    column: { field: CertificationField; label: string; width: string; numeric?: boolean },
    child = false,
    derived = false,
  ) => {
    if (derived) {
      return (
        <TableCell
          key={column.field}
          className={`${column.numeric ? "text-right tabular-nums" : "text-left"} font-bold text-foreground`}
        >
          {row[column.field] || "—"}
        </TableCell>
      );
    }

    return (
      <TableCell key={column.field} className={child ? "bg-violet-500/[0.018]" : undefined}>
        <Input
          aria-label={`${column.label} de ${row.indicator}`}
          type="text"
          inputMode={column.numeric ? "decimal" : "text"}
          value={row[column.field]}
          onChange={(event) => updateValue(cycle, row.id, column.field, event.target.value)}
          disabled={cycle !== "current" || !activePartnerId}
          className={`h-9 rounded-xl border-violet-500/20 px-2.5 text-sm font-semibold shadow-sm focus-visible:border-violet-500/50 focus-visible:ring-violet-500/15 bg-violet-500/[0.045] disabled:cursor-not-allowed disabled:opacity-65 ${column.numeric ? "text-right tabular-nums" : "text-left"}`}
        />
      </TableCell>
    );
  };

  const renderCycle = (cycle: CycleId) => {
    const activeCycle = cycles[cycle];
    const summary = withCalculatedSummary(activeCycle.summary, activeCycle.breakdown);
    const oneShot = withCalculatedOneShot(activeCycle.oneShot);
    const ftthPhysical = withCalculatedFtthPhysical(activeCycle.ftthPhysical);
    const newProductsRevenue = withCalculatedNewProductsRevenue(activeCycle.newProductsRevenue);
    const revenuePerFdv = withCalculatedRevenuePerFdv(activeCycle.revenuePerFdv);
    const qscPoints = parseCurrency(activeCycle.qsc.totalPoints);
    const totalPoints =
      [summary, oneShot, ftthPhysical, newProductsRevenue, revenuePerFdv].reduce(
        (total, row) => total + parseCurrency(row.points),
        qscPoints,
      ) ?? 0;
    const stone = certificationStone(parseCurrency(summary.totalizer), totalPoints);
    const columns = [
      ...MONTH_COLUMNS[cycle].map((column) => ({ ...column, width: "w-[105px]", numeric: true })),
      ...BASE_COLUMNS,
    ];
    const cycleLabel =
      cycle === "previous" ? "Certificação · 1º semestre" : "Certificação · 2º semestre";
    const editable = cycle === "current" && Boolean(activePartnerId);

    return (
      <Card
        key={cycle}
        className="overflow-hidden rounded-[2rem] border-violet-500/20 bg-gradient-to-br from-card via-card to-violet-500/[0.045] shadow-elevated"
      >
        <div className="flex flex-col gap-4 border-b border-violet-500/15 bg-violet-500/[0.04] px-5 py-5 md:flex-row md:items-center md:justify-between md:px-7">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-violet-500/[0.13] text-violet-700 shadow-sm ring-4 ring-background/40 dark:text-violet-300">
              <Award className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">
                {cycleLabel}
              </p>
              <h2 className="text-lg font-semibold tracking-tight">
                {cycle === "previous" ? "Resultado fechado" : "Simulador de prévia"}
              </h2>
              {cycle === "current" && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {activePartner
                    ? `PV: ${activePartner.name}`
                    : "Selecione apenas um PV no filtro para preencher a prévia."}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-2xl border border-violet-500/20 bg-background/75 px-3 py-2 text-right shadow-sm">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Pontuação total
              </p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-foreground">
                {fmtInt(totalPoints)}
              </p>
            </div>
            <div className="rounded-2xl border border-primary/20 bg-primary/[0.08] px-3 py-2 shadow-sm">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-primary">
                Pedra
              </p>
              <p className="mt-0.5 text-sm font-bold tracking-wide text-primary">{stone.stone}</p>
            </div>
            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.08] px-3 py-2 text-right shadow-sm">
              <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-300">
                Bônus
              </p>
              <p className="mt-0.5 text-sm font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                {stone.bonus}
              </p>
            </div>
            {cycle === "current" && (
              <Button
                type="button"
                size="sm"
                onClick={savePreview}
                disabled={!editable || saving || loadingPreview}
                className="h-10 rounded-2xl px-3 text-xs font-semibold"
              >
                {saving || loadingPreview ? (
                  <LoaderCircle className="size-3.5 animate-spin" />
                ) : (
                  <Save className="size-3.5" />
                )}
                Salvar prévia
              </Button>
            )}
          </div>
        </div>

        <div className="p-3 sm:p-5">
          <div className="overflow-x-auto rounded-2xl border border-violet-500/15 bg-background/80 shadow-elegant">
            <Table className="min-w-[1400px] table-fixed">
              <colgroup>
                <col className="w-[380px]" />
                {columns.map((column) => (
                  <col key={column.field} className={column.width} />
                ))}
              </colgroup>
              <TableHeader className="bg-violet-500/[0.045] [&_th]:h-auto [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-violet-500/15 [&_th]:px-3 [&_th]:py-3.5 [&_th]:text-[10px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.1em] [&_th]:text-muted-foreground">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Indicadores</TableHead>
                  {columns.map((column) => (
                    <TableHead
                      key={column.field}
                      className={column.numeric ? "text-right" : "text-left"}
                    >
                      {column.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody className="[&_td]:px-2.5 [&_td]:py-3 [&_tr]:border-violet-500/[0.09] [&_tr]:transition-colors">
                <TableRow className="bg-violet-500/[0.06] hover:bg-violet-500/[0.08]">
                  <TableCell className="px-4">
                    <button
                      type="button"
                      aria-expanded={expanded[cycle]}
                      onClick={() =>
                        setExpanded((current) => ({ ...current, [cycle]: !current[cycle] }))
                      }
                      className="group flex w-full items-center gap-3 text-left font-semibold text-foreground"
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-violet-500/[0.13] text-violet-700 transition-colors group-hover:bg-violet-500/[0.2] dark:text-violet-300">
                        <ChevronDown
                          className={`size-4 transition-transform duration-200 ${expanded[cycle] ? "rotate-180" : ""}`}
                        />
                      </span>
                      <span>{activeCycle.summary.indicator}</span>
                    </button>
                  </TableCell>
                  {columns.map((column) =>
                    valueCell(
                      cycle,
                      summary,
                      column,
                      false,
                      isCalculatedSummaryField(column.field),
                    ),
                  )}
                </TableRow>
                {expanded[cycle] &&
                  activeCycle.breakdown.map((row) => (
                    <TableRow key={row.id} className="hover:bg-violet-500/[0.04]">
                      <TableCell className="bg-violet-500/[0.018] px-4">
                        <div className="flex items-center gap-3 pl-3 text-sm font-medium text-foreground/80">
                          <span className="h-5 w-px bg-violet-500/35" />
                          {row.indicator}
                        </div>
                      </TableCell>
                      {columns.map((column) => {
                        if (column.field === "band") return null;
                        if (column.field === "points") {
                          return (
                            <TableCell
                              key="score-empty"
                              colSpan={2}
                              className="bg-violet-500/[0.018]"
                            />
                          );
                        }
                        return valueCell(cycle, row, column, true);
                      })}
                    </TableRow>
                  ))}
                <TableRow className="bg-sky-500/[0.045] hover:bg-sky-500/[0.07]">
                  <TableCell className="px-4 font-semibold text-foreground">
                    {oneShot.indicator}
                  </TableCell>
                  {columns.map((column) =>
                    valueCell(
                      cycle,
                      oneShot,
                      column,
                      false,
                      ["totalizer", "points", "band"].includes(column.field),
                    ),
                  )}
                </TableRow>
                <TableRow className="bg-emerald-500/[0.045] hover:bg-emerald-500/[0.07]">
                  <TableCell className="px-4 font-semibold text-foreground">
                    {ftthPhysical.indicator}
                  </TableCell>
                  {columns.map((column) =>
                    valueCell(
                      cycle,
                      ftthPhysical,
                      column,
                      false,
                      ["totalizer", "points", "band"].includes(column.field),
                    ),
                  )}
                </TableRow>
                <TableRow className="bg-amber-500/[0.045] hover:bg-amber-500/[0.07]">
                  <TableCell className="px-4 font-semibold text-foreground">
                    {newProductsRevenue.indicator}
                  </TableCell>
                  {columns.map((column) =>
                    valueCell(
                      cycle,
                      newProductsRevenue,
                      column,
                      false,
                      ["totalizer", "points", "band"].includes(column.field),
                    ),
                  )}
                </TableRow>
                <TableRow className="bg-rose-500/[0.045] hover:bg-rose-500/[0.07]">
                  <TableCell className="px-4 font-semibold text-foreground">
                    {revenuePerFdv.indicator}
                  </TableCell>
                  {columns.map((column) =>
                    valueCell(
                      cycle,
                      revenuePerFdv,
                      column,
                      false,
                      ["totalizer", "points", "band"].includes(column.field),
                    ),
                  )}
                </TableRow>
                <CertificationQscHistory
                  rows={activeCycle.qsc.rows}
                  totalPoints={activeCycle.qsc.totalPoints}
                  onChange={(rowId, field, value) => updateQscValue(cycle, rowId, field, value)}
                  readOnly={!editable}
                />
              </TableBody>
            </Table>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <Tabs
      value={view}
      onValueChange={(value) => setView(value as typeof view)}
      className="space-y-5"
    >
      <TabsList className="h-auto flex-wrap justify-start gap-1 rounded-2xl border border-violet-500/15 bg-violet-500/[0.045] p-1.5">
        <TabsTrigger value="previous" className="h-10 rounded-xl px-4 text-xs font-semibold">
          1º Ciclo · Resultado fechado
        </TabsTrigger>
        <TabsTrigger value="current" className="h-10 rounded-xl px-4 text-xs font-semibold">
          2º Ciclo · Simulador
        </TabsTrigger>
        <TabsTrigger value="pbi" className="h-10 rounded-xl px-4 text-xs font-semibold">
          PBI Certificação
        </TabsTrigger>
      </TabsList>

      <TabsContent value="previous">{renderCycle("previous")}</TabsContent>
      <TabsContent value="current">{renderCycle("current")}</TabsContent>
      <TabsContent value="pbi">
        <Card className="overflow-hidden rounded-[2rem] border-violet-500/20 bg-card shadow-elevated">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-violet-500/15 bg-violet-500/[0.04] px-5 py-5 md:px-7">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">
                Power BI
              </p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">Certificação</h2>
            </div>
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <a href={CERTIFICATION_POWER_BI_URL} target="_blank" rel="noreferrer">
                Abrir no Power BI <ExternalLink className="size-4" />
              </a>
            </Button>
          </div>
          <iframe
            title="PBI de Certificação"
            src={CERTIFICATION_POWER_BI_URL}
            className="min-h-[760px] w-full border-0"
            allowFullScreen
          />
        </Card>
      </TabsContent>
    </Tabs>
  );
}
