import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  CertificationQscHistory,
  type CertificationQscField,
  type CertificationQscRow,
} from "@/components/CertificationQscHistory";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePartnerFilter } from "@/contexts/AppContexts";
import { usePartners } from "@/hooks/useData";
import { fmtInt } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableScroll } from "@/components/TableScroll";
import { EmptyState } from "@/components/EmptyState";
import { SaveState, type SaveStatus } from "@/components/SaveState";

type CertificationField =
  "jan" | "feb" | "mar" | "apr" | "may" | "jun" | "totalizer" | "points" | "band";

type CertificationRow = Record<CertificationField, string> & { id: string; indicator: string };
type CycleId = "previous" | "current";

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

type CertificationColumn = {
  field: CertificationField;
  label: string;
  width: string;
  align: "numeric" | "state";
};

const BASE_COLUMNS: CertificationColumn[] = [
  // Largura dimensionada pelo conteudo financeiro: o totalizador precisa exibir
  // valores com centavos por inteiro e a Faixa nao pode ficar fora da area util.
  { field: "totalizer", label: "Totalizador", width: "w-[168px]", align: "numeric" },
  { field: "points", label: "Pts", width: "w-[112px]", align: "numeric" },
  { field: "band", label: "Faixa", width: "w-[132px]", align: "state" },
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

type CyclePayload = (typeof INITIAL_CYCLES)["current"];

const CYCLE_META: Record<CycleId, { tab: string; title: string; period: string; note: string }> = {
  previous: {
    tab: "1º ciclo · fechado",
    title: "1º ciclo · resultado fechado",
    period: "Janeiro a junho",
    note: "Apuração encerrada; valores somente leitura.",
  },
  current: {
    tab: "2º ciclo · simulação",
    title: "2º ciclo · simulação",
    period: "Julho a dezembro",
    note: "Ciclo em aberto; preencha os meses, o restante é calculado.",
  },
};

/**
 * Identificação persistente: a primeira coluna acompanha a rolagem horizontal, para
 * que o indicador continue legível sem retirar nenhuma coluna da tabela.
 */
const STICKY_ID_CLASS = "sticky left-0 z-[1] whitespace-normal";
const TABLE_HEADER_CLASS =
  "bg-muted [&_th]:h-auto [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-border [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-xs [&_th]:font-semibold [&_th]:leading-4 [&_th]:text-foreground";
const TABLE_BODY_CLASS = "[&_td]:px-3 [&_td]:py-2 [&_tr]:border-border";
const FIELD_CLASS = "h-9 px-2 text-sm";
const DERIVED_FIELDS = ["totalizer", "points", "band"];

/** Gravação da prévia. Mesmo endpoint já usado pelo autosave; nenhuma API nova. */
async function putPreview(partnerId: string, payload: CyclePayload) {
  const response = await fetch("/api/certificacao/previa", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ partnerId, payload }),
  });
  const body = (await response.json()) as { message?: string };
  if (!response.ok) throw new Error(body.message ?? "Não foi possível salvar a prévia.");
}

type PendingWrite = { partnerId: string; partnerName: string; payload: CyclePayload };

export function CertificationPanel() {
  const [cycles, setCycles] = useState(INITIAL_CYCLES);
  // Identidade do ciclo em simulação: muda a cada edição e reinicia o debounce do autosave.
  const currentCycle = cycles.current;
  const [view, setView] = useState<CycleId>("previous");
  const [expanded, setExpanded] = useState<Record<CycleId, boolean>>({
    previous: false,
    current: false,
  });
  const [hasPendingChanges, setHasPendingChanges] = useState(false);
  const [saveState, setSaveState] = useState<SaveStatus>("idle");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  /**
   * Gravação pendente do PV anterior. Enquanto existir, a troca de parceiro não é
   * concluída: a prévia do novo PV não é carregada nem editada, de modo que nenhuma
   * alteração vaze entre parceiros.
   */
  const [pendingTransfer, setPendingTransfer] = useState<PendingWrite | null>(null);
  const [transferAttempt, setTransferAttempt] = useState(0);
  const pendingRef = useRef<PendingWrite | null>(null);

  const { effectiveSelected, role, allowedPartnerIds } = usePartnerFilter();
  const { data: partners = [] } = usePartners();
  const candidatePartnerId = effectiveSelected.length === 1 ? effectiveSelected[0] : null;
  const activePartner = useMemo(
    () => partners.find((partner) => partner.id === candidatePartnerId) ?? null,
    [candidatePartnerId, partners],
  );
  const activePartnerId = activePartner?.id ?? null;
  const hasNoAuthorizedPartners = role === "gn" && (allowedPartnerIds?.length ?? 0) === 0;

  /*
    Carga da prévia do PV. Declarada antes do autosave para que a troca de parceiro
    seja tratada antes de qualquer gravação agendada para o parceiro anterior.
  */
  useEffect(() => {
    const pending = pendingRef.current;
    if (pending && pending.partnerId !== activePartnerId) {
      pendingRef.current = null;
      setHasPendingChanges(false);
      setPendingTransfer(pending);
      return;
    }
    if (pendingTransfer) return;

    if (!activePartnerId) {
      setCycles((current) => ({ ...current, current: INITIAL_CYCLES.current }));
      setHasPendingChanges(false);
      setSaveState("idle");
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setHasPendingChanges(false);
    setSaveState("idle");
    setLoadError(null);
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
          current: hasExpectedShape ? (preview as CyclePayload) : INITIAL_CYCLES.current,
        }));
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setLoadError(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activePartnerId, pendingTransfer, reloadToken]);

  /* Conclusão da gravação pendente antes de adotar o parceiro recém-selecionado. */
  useEffect(() => {
    if (!pendingTransfer) return;
    let cancelled = false;
    setSaveState("saving");
    void putPreview(pendingTransfer.partnerId, pendingTransfer.payload)
      .then(() => {
        if (cancelled) return;
        setSaveState("saved");
        setPendingTransfer(null);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setSaveState("error");
        toast.error(error instanceof Error ? error.message : "Não foi possível salvar a prévia.");
      });
    return () => {
      cancelled = true;
    };
  }, [pendingTransfer, transferAttempt]);

  /* Autosave do ciclo em simulação. */
  useEffect(() => {
    if (!activePartnerId || !hasPendingChanges || loadingPreview || pendingTransfer) return;
    const pending = pendingRef.current;
    // A gravação só vale para o parceiro que originou a alteração.
    if (!pending || pending.partnerId !== activePartnerId) return;

    const timer = window.setTimeout(() => {
      setSaveState("saving");
      void putPreview(pending.partnerId, pending.payload)
        .then(() => {
          if (pendingRef.current === pending) {
            pendingRef.current = null;
            setHasPendingChanges(false);
          }
          setSaveState("saved");
        })
        .catch((error: unknown) => {
          setSaveState("error");
          toast.error(error instanceof Error ? error.message : "Não foi possível salvar a prévia.");
        });
    }, 700);

    return () => window.clearTimeout(timer);
  }, [activePartnerId, currentCycle, hasPendingChanges, loadingPreview, pendingTransfer]);

  const editable =
    Boolean(activePartnerId) && !loadingPreview && !pendingTransfer && loadError === null;

  const commit = (next: CyclePayload) => {
    if (!activePartnerId) return;
    pendingRef.current = {
      partnerId: activePartnerId,
      partnerName: activePartner?.name ?? activePartnerId,
      payload: next,
    };
    setHasPendingChanges(true);
    setSaveState("idle");
    setCycles((current) => ({ ...current, current: next }));
  };

  const updateValue = (rowId: string, field: CertificationField, value: string) => {
    if (!editable) return;
    const cycle = currentCycle;
    const derivedRowIds = [
      cycle.oneShot.id,
      cycle.ftthPhysical.id,
      cycle.newProductsRevenue.id,
      cycle.revenuePerFdv.id,
    ];
    // Campos calculados nunca são gravados a partir da interface.
    if (rowId === cycle.summary.id && isCalculatedSummaryField(field)) return;
    if (derivedRowIds.includes(rowId) && DERIVED_FIELDS.includes(field)) return;

    commit({
      ...cycle,
      summary: rowId === cycle.summary.id ? { ...cycle.summary, [field]: value } : cycle.summary,
      oneShot: rowId === cycle.oneShot.id ? { ...cycle.oneShot, [field]: value } : cycle.oneShot,
      ftthPhysical:
        rowId === cycle.ftthPhysical.id
          ? { ...cycle.ftthPhysical, [field]: value }
          : cycle.ftthPhysical,
      newProductsRevenue:
        rowId === cycle.newProductsRevenue.id
          ? { ...cycle.newProductsRevenue, [field]: value }
          : cycle.newProductsRevenue,
      revenuePerFdv:
        rowId === cycle.revenuePerFdv.id
          ? { ...cycle.revenuePerFdv, [field]: value }
          : cycle.revenuePerFdv,
      breakdown: cycle.breakdown.map((row) =>
        row.id === rowId ? { ...row, [field]: value } : row,
      ),
    });
  };

  const updateQscValue = (rowId: string, field: CertificationQscField, value: string) => {
    if (!editable) return;
    const cycle = currentCycle;
    commit({
      ...cycle,
      qsc:
        rowId === "qsc-total"
          ? { ...cycle.qsc, totalPoints: value }
          : {
              ...cycle.qsc,
              rows: cycle.qsc.rows.map((row) =>
                row.id === rowId ? { ...row, [field]: value } : row,
              ),
            },
    });
  };

  /*
    Valor somente de leitura é texto. Resultado fechado e resultado calculado não são
    apresentados como campo desabilitado, que aparenta ser editável e perde contraste.
  */
  const readOnlyCell = (row: CertificationRow, column: CertificationColumn) => (
    <TableCell key={column.field} align={column.align} className="font-medium text-foreground">
      {row[column.field].trim() === "" ? "—" : row[column.field]}
    </TableCell>
  );

  const editableCell = (row: CertificationRow, column: CertificationColumn) => (
    <TableCell key={column.field} align={column.align}>
      <Input
        aria-label={`${column.label} de ${row.indicator}`}
        type="text"
        inputMode={column.align === "numeric" ? "decimal" : "text"}
        value={row[column.field]}
        onChange={(event) => updateValue(row.id, column.field, event.target.value)}
        className={cn(
          FIELD_CLASS,
          column.align === "numeric" ? "text-right tabular-nums" : "text-center",
        )}
      />
    </TableCell>
  );

  const renderCycle = (cycle: CycleId) => {
    const activeCycle = cycles[cycle];
    const meta = CYCLE_META[cycle];
    const summary = withCalculatedSummary(activeCycle.summary, activeCycle.breakdown);
    const oneShot = withCalculatedOneShot(activeCycle.oneShot);
    const ftthPhysical = withCalculatedFtthPhysical(activeCycle.ftthPhysical);
    const newProductsRevenue = withCalculatedNewProductsRevenue(activeCycle.newProductsRevenue);
    const revenuePerFdv = withCalculatedRevenuePerFdv(activeCycle.revenuePerFdv);
    const qscPoints = parseCurrency(activeCycle.qsc.totalPoints);
    const totalPoints = [summary, oneShot, ftthPhysical, newProductsRevenue, revenuePerFdv].reduce(
      (total, row) => total + parseCurrency(row.points),
      qscPoints,
    );
    const stone = certificationStone(parseCurrency(summary.totalizer), totalPoints);
    const monthColumns = MONTH_COLUMNS[cycle].map((column): CertificationColumn => ({
      ...column,
      width: "w-[136px]",
      align: "numeric",
    }));
    const columns = [...monthColumns, ...BASE_COLUMNS];
    // Simulação só é editável no ciclo atual, com um PV resolvido e sem carga pendente.
    const cycleEditable = cycle === "current" && editable;

    const derivedRow = (row: CertificationRow) => (
      <TableRow key={row.id}>
        <TableCell className={cn(STICKY_ID_CLASS, "bg-card font-medium text-foreground")}>
          {row.indicator}
        </TableCell>
        {columns.map((column) =>
          cycleEditable && !DERIVED_FIELDS.includes(column.field)
            ? editableCell(row, column)
            : readOnlyCell(row, column),
        )}
      </TableRow>
    );

    const table = (
      <Table className="min-w-[1488px] table-fixed">
        <colgroup>
          <col className="w-[260px]" />
          {columns.map((column) => (
            <col key={column.field} className={column.width} />
          ))}
        </colgroup>
        <TableHeader className={TABLE_HEADER_CLASS}>
          <TableRow className="hover:bg-transparent">
            <TableHead className={cn(STICKY_ID_CLASS, "bg-muted")}>Indicadores</TableHead>
            {columns.map((column) => (
              <TableHead key={column.field} align={column.align}>
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className={TABLE_BODY_CLASS}>
          <TableRow className="bg-muted/60">
            <TableCell className={cn(STICKY_ID_CLASS, "bg-muted font-semibold text-foreground")}>
              <button
                type="button"
                aria-expanded={expanded[cycle]}
                onClick={() => setExpanded((current) => ({ ...current, [cycle]: !current[cycle] }))}
                className="flex w-full items-start gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <ChevronDown
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-150",
                    expanded[cycle] && "rotate-180",
                  )}
                />
                <span>{activeCycle.summary.indicator}</span>
              </button>
            </TableCell>
            {/* Consolidado: soma da composição, com pontuação e faixa calculadas. */}
            {columns.map((column) => readOnlyCell(summary, column))}
          </TableRow>
          {expanded[cycle] &&
            activeCycle.breakdown.map((row) => (
              <TableRow key={row.id}>
                <TableCell className={cn(STICKY_ID_CLASS, "bg-card pl-8 text-foreground")}>
                  {row.indicator}
                </TableCell>
                {columns.map((column) => {
                  // A composição não usa Pts nem Faixa: a pontuação é do consolidado.
                  if (column.field === "points" || column.field === "band") {
                    return <TableCell key={column.field} aria-hidden="true" />;
                  }
                  return cycleEditable ? editableCell(row, column) : readOnlyCell(row, column);
                })}
              </TableRow>
            ))}
          {derivedRow(oneShot)}
          {derivedRow(ftthPhysical)}
          {derivedRow(newProductsRevenue)}
          {derivedRow(revenuePerFdv)}
          <CertificationQscHistory
            rows={activeCycle.qsc.rows}
            totalPoints={activeCycle.qsc.totalPoints}
            monthLabels={MONTH_COLUMNS[cycle].map((column) => column.label)}
            onChange={updateQscValue}
            readOnly={!cycleEditable}
          />
        </TableBody>
      </Table>
    );

    const loading = cycle === "current" && loadingPreview;

    return (
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-3.5 md:flex-row md:items-start md:justify-between md:gap-4 md:px-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold leading-[1.45] tracking-tight text-foreground">
              {meta.title}
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
              PV {activePartner?.name ?? "—"} · {meta.period} · {meta.note}
            </p>
          </div>
          {cycle === "current" && (
            <div className="shrink-0">
              <SaveState status={saveState} busy={loadingPreview} />
            </div>
          )}
        </div>

        {/* Faixa de métricas relacionadas do ciclo; sem um card por métrica. */}
        <dl className="grid grid-cols-1 divide-y divide-border border-b border-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {[
            { label: "Pontuação total", value: fmtInt(totalPoints), numeric: true },
            { label: "Pedra", value: stone.stone, numeric: false },
            { label: "Bônus", value: stone.bonus, numeric: true },
          ].map((metric) => (
            <div key={metric.label} className="px-4 py-3 md:px-5">
              <dt className="text-xs font-medium text-muted-foreground">{metric.label}</dt>
              <dd
                className={cn(
                  "mt-1 text-lg font-semibold text-foreground",
                  metric.numeric && "tabular-nums",
                )}
              >
                {metric.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="p-4 md:p-5">
          {loading ? (
            <div>
              <div className="space-y-2" aria-hidden="true">
                <Skeleton className="h-9 w-full" />
                {Array.from({ length: 6 }, (_, index) => (
                  <Skeleton key={index} className="h-10 w-full" />
                ))}
              </div>
              <p className="sr-only" role="status">
                Carregando a simulação do PV selecionado.
              </p>
            </div>
          ) : (
            <TableScroll>{table}</TableScroll>
          )}
        </div>
      </Card>
    );
  };

  if (!activePartnerId) {
    return (
      <Card className="overflow-hidden">
        <div className="p-4 md:p-5">
          <EmptyState
            title={hasNoAuthorizedPartners ? "Nenhum parceiro autorizado" : "Selecione um único PV"}
            description={
              hasNoAuthorizedPartners
                ? "Seu perfil de GN ainda não possui vínculo com um parceiro. Procure o Diretor antes de consultar ou preencher a Certificação."
                : "A Certificação é apurada por PV: o ciclo fechado e a simulação pertencem a um parceiro. Use o filtro de parceiros no menu superior e mantenha apenas um selecionado."
            }
          />
        </div>
      </Card>
    );
  }

  /*
    Troca de parceiro com gravação pendente: a simulação anterior é gravada antes de
    o painel adotar o novo PV. Enquanto não concluir, nada do parceiro anterior é
    exibido nem editado sob o parceiro recém-selecionado.
  */
  if (pendingTransfer) {
    const failed = saveState === "error";
    return (
      <Card className="overflow-hidden">
        <div className="flex flex-col items-start gap-3 px-4 py-4 md:px-5">
          <div>
            <h2 className="text-lg font-semibold leading-[1.45] tracking-tight text-foreground">
              {failed
                ? "Alterações do PV anterior não foram salvas"
                : "Concluindo a gravação do PV anterior"}
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
              {failed
                ? `A simulação de ${pendingTransfer.partnerName} tem alterações pendentes. A troca de PV só é concluída após a gravação, para que nada seja perdido nem aplicado ao parceiro errado.`
                : `Salvando a simulação de ${pendingTransfer.partnerName} antes de abrir o PV selecionado.`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SaveState status={saveState} />
            {failed && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTransferAttempt((attempt) => attempt + 1)}
              >
                Tentar novamente
              </Button>
            )}
          </div>
        </div>
      </Card>
    );
  }

  if (loadError) {
    return (
      <Card className="overflow-hidden">
        <div className="flex flex-col items-start gap-3 px-4 py-4 md:px-5">
          <div>
            <h2 className="text-lg font-semibold leading-[1.45] tracking-tight text-foreground">
              Não foi possível carregar a simulação
            </h2>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
              {loadError} O PV selecionado foi preservado.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setReloadToken((token) => token + 1)}>
            Tentar novamente
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Tabs value={view} onValueChange={(value) => setView(value as CycleId)} className="space-y-4">
      <TabsList className="h-auto flex-wrap justify-start gap-1">
        {(["previous", "current"] as const).map((cycle) => (
          <TabsTrigger key={cycle} value={cycle}>
            {CYCLE_META[cycle].tab}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="previous">{renderCycle("previous")}</TabsContent>
      <TabsContent value="current">{renderCycle("current")}</TabsContent>
    </Tabs>
  );
}
