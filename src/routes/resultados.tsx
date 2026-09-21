import { createFileRoute, Link } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import {
  ArrowRight,
  Award,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileDown,
  PencilLine,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { usePartnerFilter } from "@/contexts/AppContexts";
import { usePartners, useQsc } from "@/hooks/useData";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/EmptyState";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableScroll } from "@/components/TableScroll";
import { cn } from "@/lib/utils";
import { fmtDec, fmtPct } from "@/lib/format";
import { readXlsxRows } from "@/lib/xlsx-reader";
import { resultadosYoyCells, resultadosYoyColumns } from "@/lib/resultados-yoy-columns";
import type {
  BestGuessRecord,
  BestGuessTotal,
  PortabilidadeSnapshot,
  ResultadosYoySnapshot,
  ServiceTower,
} from "@/lib/snapshot-types";

type PeriodInput = { meta: number; real: number };
type EditableMetric = { previous: PeriodInput; current: PeriodInput };
type PeriodCalculation = { attainment: number; gap: number; average: number };
type ResultRow = {
  id: string;
  product: string;
  previousInput: PeriodInput;
  currentInput: PeriodInput;
  previous: PeriodCalculation;
  current: PeriodCalculation;
  yoy: number | null;
  yoyGap: number;
};
type PeriodKey = keyof EditableMetric;
type CertificationField =
  "jan" | "feb" | "mar" | "apr" | "may" | "jun" | "totalizer" | "points" | "band";
type CertificationRow = Record<CertificationField, string> & { id: string; indicator: string };
type ReportSource = ResultadosYoySnapshot["source"];
type SourceRecord = ResultadosYoySnapshot["records"][number];
type AnalyticalRecord = PortabilidadeSnapshot["records"][number];
type RuntimeResults = {
  resultados: { source: ReportSource; records: SourceRecord[] };
  bestGuess: { records: BestGuessRecord[]; total: BestGuessTotal };
  portabilidade: { records: AnalyticalRecord[] };
  torres: { towers: ServiceTower[] };
};
type PortabilitySummaryRow = {
  month: number;
  label: string;
  portIn: number;
  portOut: number;
  saldo: number;
  conversion: number | null;
  leaderPortIn: string;
  leaderPortInVolume: number;
  leaderPortOut: string;
  leaderPortOutVolume: number;
};
type PortabilitySummaryTotal = Omit<PortabilitySummaryRow, "month" | "label">;

const INITIAL_CERTIFICATION_ROWS: CertificationRow[] = [
  {
    id: "altas",
    indicator: "Altas",
    jan: "",
    feb: "",
    mar: "",
    apr: "1.500",
    may: "",
    jun: "",
    totalizer: "",
    points: "",
    band: "",
  },
  {
    id: "receita-total",
    indicator: "Receita Telecom + Digital + TI + Loc de Equipamentos",
    jan: "19.557,01",
    feb: "17.413,03",
    mar: "19.184,12",
    apr: "17.169,82",
    may: "19.384,70",
    jun: "15.152,06",
    totalizer: "17.976,79",
    points: "1.100",
    band: "FAIXA 1",
  },
  {
    id: "receita-dados-avancados",
    indicator: "Receita Dados Avançados",
    jan: "5.900,00",
    feb: "1.500,00",
    mar: "2.000,00",
    apr: "0,00",
    may: "1.414,08",
    jun: "0,00",
    totalizer: "2.703,52",
    points: "300",
    band: "FAIXA 3",
  },
  {
    id: "receita-voz-avancada",
    indicator: "Receita Voz Avançada",
    jan: "2.634,98",
    feb: "2.300,00",
    mar: "2.210,00",
    apr: "1.675,00",
    may: "1.230,00",
    jun: "974,00",
    totalizer: "1.837,33",
    points: "100",
    band: "FAIXA 2",
  },
  {
    id: "receita-licencas",
    indicator: "RECEITA LICENÇAS",
    jan: "0,00",
    feb: "61,40",
    mar: "79,00",
    apr: "10,00",
    may: "92,00",
    jun: "0,00",
    totalizer: "60,60",
    points: "0",
    band: "FAIXA 0",
  },
  {
    id: "receita-eletronicos",
    indicator: "RECEITA ELETRÔNICOS + EQUIPAMENTOS + ENERGIA + ONE SHOT",
    jan: "208.827,00",
    feb: "213.655,00",
    mar: "210.800,00",
    apr: "294.668,00",
    may: "384.528,00",
    jun: "261.681,00",
    totalizer: "262.359,833",
    points: "300",
    band: "FAIXA 3",
  },
  {
    id: "receita-ftth",
    indicator: "RECEITA FTTH (DADOS + VOZ)",
    jan: "1.115,89",
    feb: "1.249,87",
    mar: "1.564,84",
    apr: "3.756,61",
    may: "4.929,49",
    jun: "3.119,69",
    totalizer: "2.622,73",
    points: "0",
    band: "FAIXA 0",
  },
  {
    id: "receita-locacao",
    indicator: "RECEITA LOC DE EQUIPAMENTOS",
    jan: "0,00",
    feb: "169,99",
    mar: "0,00",
    apr: "172,99",
    may: "276,99",
    jun: "0,00",
    totalizer: "103,33",
    points: "0",
    band: "FAIXA 0",
  },
];

const asNumber = (value: string) => (Number.isFinite(Number(value)) ? Number(value) : 0);
const inputNumberFormatter = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const formatInputNumber = (value: number) =>
  inputNumberFormatter.format(Number.isFinite(value) ? value : 0);
const parseInputNumber = (value: string) => {
  const compact = value.replace(/\s/g, "");
  if (!compact) return 0;

  const commaIndex = compact.lastIndexOf(",");
  const dotIndexes = [...compact].flatMap((character, index) => (character === "." ? [index] : []));
  let normalized = compact;
  if (commaIndex >= 0) {
    normalized = compact.replace(/\./g, "").replace(",", ".");
  } else if (
    dotIndexes.length > 1 ||
    (dotIndexes.length === 1 && compact.length - dotIndexes[0] - 1 === 3)
  ) {
    normalized = compact.replace(/\./g, "");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};
const normalizeCompany = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "")
    .toLocaleLowerCase("pt-BR");

const productLabels: Record<string, string> = {
  movelliquidopv: "Móvel Líquido",
  aparelhospv: "Aparelhos",
  bandalargapv: "Banda Larga",
  dadosavancadospv: "Dados Avançados",
  vvnpv: "VVN",
  vozavancadapv: "Voz Avançada",
  tirecorrentepv: "TI Recorrente",
  vivotechpv: "Vivo Tech",
};

const numberFromCell = (value: unknown) => {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return Number.NaN;
  return Number(value.replace(/\./g, "").replace(",", "."));
};

function recordsFromSpreadsheet(rows: unknown[][]): SourceRecord[] {
  const headerIndex = rows.findIndex(
    (row) => normalizeCompany(String(row[2] ?? "")) === "nomerede",
  );
  if (headerIndex < 0) throw new Error("Coluna NOME_REDE não encontrada no modelo de planilha.");

  const columns = resultadosYoyColumns(rows[headerIndex] ?? []);
  let product = "";
  const records: SourceRecord[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const cells = resultadosYoyCells(row, columns);
    const rawProduct = String(cells.product ?? "").trim();
    if (rawProduct) product = rawProduct;
    const company = String(cells.company ?? "").trim();
    const meta = numberFromCell(cells.meta);
    const real = numberFromCell(cells.real);
    if (!product || !company || !Number.isFinite(meta) || !Number.isFinite(real)) continue;
    records.push({
      company,
      product: productLabels[normalizeCompany(product)] ?? product,
      meta,
      real,
      attainment: Number.isFinite(numberFromCell(cells.attainment))
        ? numberFromCell(cells.attainment)
        : 0,
      gap: Number.isFinite(numberFromCell(cells.gap)) ? numberFromCell(cells.gap) : 0,
      average: Number.isFinite(numberFromCell(cells.average)) ? numberFromCell(cells.average) : 0,
      previousMeta: Number.isFinite(numberFromCell(cells.previousMeta))
        ? numberFromCell(cells.previousMeta)
        : 0,
      previousReal: Number.isFinite(numberFromCell(cells.previousReal))
        ? numberFromCell(cells.previousReal)
        : 0,
      previousAttainment: Number.isFinite(numberFromCell(cells.previousAttainment))
        ? numberFromCell(cells.previousAttainment)
        : 0,
      previousGap: Number.isFinite(numberFromCell(cells.previousGap))
        ? numberFromCell(cells.previousGap)
        : 0,
      previousAverage: Number.isFinite(numberFromCell(cells.previousAverage))
        ? numberFromCell(cells.previousAverage)
        : 0,
      yoy: Number.isFinite(numberFromCell(cells.yoy)) ? numberFromCell(cells.yoy) : 0,
      yoyGap: Number.isFinite(numberFromCell(cells.yoyGap)) ? numberFromCell(cells.yoyGap) : 0,
    });
  }
  if (!records.length)
    throw new Error("Nenhuma linha de resultado foi encontrada no modelo informado.");
  return records;
}

function recordsFromBestGuessSpreadsheet(rows: unknown[][]): {
  records: BestGuessRecord[];
  total: BestGuessTotal;
} {
  const requiredHeaders = [
    "parceiro",
    "m0mtdportin",
    "m0mtdportout",
    "m0mtdsaldo",
    "bgfmportin",
    "bgfmportout",
    "bgfmsaldo",
  ];
  const headerIndex = rows.findIndex((row) => {
    const headers = row.map((value) => normalizeCompany(String(value ?? "")));
    return requiredHeaders.every((header) => headers.includes(header));
  });
  if (headerIndex < 0) throw new Error("Colunas do modelo RESUMO BEST GUESS não encontradas.");

  const headers = rows[headerIndex].map((value) => normalizeCompany(String(value ?? "")));
  const column = (name: string) => headers.indexOf(name);
  const partnerColumn = column("parceiro");
  const divisionColumn = column("nmdivisao");
  const fields = [
    ["m0MtdPortIn", "m0mtdportin"],
    ["m0MtdPortOut", "m0mtdportout"],
    ["m0MtdSaldo", "m0mtdsaldo"],
    ["bgFmPortIn", "bgfmportin"],
    ["bgFmPortOut", "bgfmportout"],
    ["bgFmSaldo", "bgfmsaldo"],
  ] as const;
  const valueFor = (row: unknown[], header: string) => {
    const value = numberFromCell(row[column(header)]);
    return Number.isFinite(value) ? value : 0;
  };
  const emptyTotal: BestGuessTotal = {
    m0MtdPortIn: 0,
    m0MtdPortOut: 0,
    m0MtdSaldo: 0,
    bgFmPortIn: 0,
    bgFmPortOut: 0,
    bgFmSaldo: 0,
  };
  const records: BestGuessRecord[] = [];
  let total = { ...emptyTotal };

  for (const row of rows.slice(headerIndex + 1)) {
    const company = String(row[partnerColumn] ?? "").trim();
    if (!company) continue;
    const values = Object.fromEntries(
      fields.map(([key, header]) => [key, valueFor(row, header)]),
    ) as BestGuessTotal;
    if (normalizeCompany(company) === "total") {
      total = values;
      continue;
    }
    records.push({ company, division: String(row[divisionColumn] ?? "").trim(), ...values });
  }
  if (!records.length)
    throw new Error("Nenhuma linha de Best Guess foi encontrada no modelo informado.");
  if (!Object.values(total).some((value) => value !== 0)) {
    total = records.reduce(
      (sum, record) => {
        for (const key of Object.keys(sum) as (keyof BestGuessTotal)[]) sum[key] += record[key];
        return sum;
      },
      { ...emptyTotal },
    );
  }
  return { records, total };
}

function recordsFromAnalyticalSpreadsheet(rows: unknown[][]): AnalyticalRecord[] {
  const requiredHeaders = [
    "grupoeconomico",
    "anomesagendamento",
    "tipoportabilidade",
    "operadora",
    "portinfm",
    "portoutfm",
  ];
  const headerIndex = rows.findIndex((row) => {
    const headers = row.map((value) => normalizeCompany(String(value ?? "")));
    return requiredHeaders.every((header) => headers.includes(header));
  });
  if (headerIndex < 0) throw new Error("Colunas do modelo Analítico não encontradas.");

  const headers = rows[headerIndex].map((value) => normalizeCompany(String(value ?? "")));
  const column = (name: string) => headers.indexOf(name);
  const companyColumn = column("grupoeconomico");
  const monthColumn = column("anomesagendamento");
  const typeColumn = column("tipoportabilidade");
  const operatorColumn = column("operadora");
  const portInColumn = column("portinfm");
  const portOutColumn = column("portoutfm");
  const records: AnalyticalRecord[] = [];

  for (const row of rows.slice(headerIndex + 1)) {
    const company = String(row[companyColumn] ?? "").trim();
    const rawMonth = numberFromCell(row[monthColumn]);
    const type = String(row[typeColumn] ?? "").trim();
    const operator = String(row[operatorColumn] ?? "").trim();
    if (!company || !Number.isFinite(rawMonth) || !type || !operator) continue;
    records.push({
      company,
      month: Math.trunc(rawMonth),
      operator,
      portIn: Number.isFinite(numberFromCell(row[portInColumn]))
        ? numberFromCell(row[portInColumn])
        : 0,
      portOut: Number.isFinite(numberFromCell(row[portOutColumn]))
        ? numberFromCell(row[portOutColumn])
        : 0,
    });
  }
  if (!records.length)
    throw new Error("Nenhuma linha detalhada foi encontrada no modelo Analítico.");
  return records;
}

const monthLabelFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });
const integerFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 });
const formatInteger = (value: number) =>
  integerFormatter.format(Math.round(Number.isFinite(value) ? value : 0));
const formatMonthLabel = (month: number) => {
  const monthName = monthLabelFormatter.format(
    new Date(Date.UTC(Math.trunc(month / 100), (month % 100) - 1, 1)),
  );
  return `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${String(Math.trunc(month / 100))}`;
};

function buildPortabilitySummary(records: AnalyticalRecord[]): {
  rows: PortabilitySummaryRow[];
  total: PortabilitySummaryTotal;
} {
  const monthly = new Map<
    number,
    { portIn: number; portOut: number; byIn: Map<string, number>; byOut: Map<string, number> }
  >();
  const availableMonths = [
    ...new Set(records.map((record) => record.month).filter((month) => Number.isFinite(month))),
  ]
    .sort((left, right) => left - right)
    .slice(-6);
  for (const month of availableMonths)
    monthly.set(month, { portIn: 0, portOut: 0, byIn: new Map(), byOut: new Map() });
  for (const record of records) {
    const bucket = monthly.get(record.month);
    if (!bucket) continue;
    bucket.portIn += record.portIn;
    bucket.portOut += record.portOut;
    bucket.byIn.set(record.operator, (bucket.byIn.get(record.operator) ?? 0) + record.portIn);
    bucket.byOut.set(record.operator, (bucket.byOut.get(record.operator) ?? 0) + record.portOut);
  }
  const leader = (values: Map<string, number>) => {
    const result = [...values.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
    return result && result[1] > 0
      ? { name: result[0], volume: result[1] }
      : { name: "—", volume: 0 };
  };
  const rows = [...monthly.entries()]
    .sort(([left], [right]) => left - right)
    .map(([month, bucket]) => {
      const leaderPortIn = leader(bucket.byIn);
      const leaderPortOut = leader(bucket.byOut);
      const saldo = bucket.portIn - bucket.portOut;
      return {
        month,
        label: formatMonthLabel(month),
        portIn: bucket.portIn,
        portOut: bucket.portOut,
        saldo,
        conversion: bucket.portIn > 0 ? saldo / bucket.portIn : null,
        leaderPortIn: leaderPortIn.name,
        leaderPortInVolume: leaderPortIn.volume,
        leaderPortOut: leaderPortOut.name,
        leaderPortOutVolume: leaderPortOut.volume,
      };
    });
  const totalPortIn = rows.reduce((sum, row) => sum + row.portIn, 0);
  const totalPortOut = rows.reduce((sum, row) => sum + row.portOut, 0);
  const totalByIn = new Map<string, number>();
  const totalByOut = new Map<string, number>();
  for (const record of records) {
    if (!monthly.has(record.month)) continue;
    totalByIn.set(record.operator, (totalByIn.get(record.operator) ?? 0) + record.portIn);
    totalByOut.set(record.operator, (totalByOut.get(record.operator) ?? 0) + record.portOut);
  }
  const totalLeaderIn = leader(totalByIn);
  const totalLeaderOut = leader(totalByOut);
  const totalSaldo = totalPortIn - totalPortOut;
  return {
    rows,
    total: {
      portIn: totalPortIn,
      portOut: totalPortOut,
      saldo: totalSaldo,
      conversion: totalPortIn > 0 ? totalSaldo / totalPortIn : null,
      leaderPortIn: totalLeaderIn.name,
      leaderPortInVolume: totalLeaderIn.volume,
      leaderPortOut: totalLeaderOut.name,
      leaderPortOutVolume: totalLeaderOut.volume,
    },
  };
}
/**
 * Linguagem única das seções desta página-piloto (Etapa 3).
 *
 * Todas as tabelas — Torres, YTD, Best Guess e portabilidade analítica — passam a
 * compartilhar a mesma borda de leitura: cabeçalho em superfície sutil, altura de
 * linha constante, número à direita com `tabular-nums` e totalizador por borda e
 * peso, sem card extra. Nenhuma coluna, ordem, fórmula ou arredondamento muda aqui.
 */
const TABLE_HEADER_CLASS =
  "bg-muted [&_th]:h-auto [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-border [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-xs [&_th]:font-semibold [&_th]:leading-4 [&_th]:text-foreground";
const TABLE_BODY_CLASS =
  "[&_td]:whitespace-nowrap [&_td]:px-3 [&_td]:py-2.5 [&_tr]:border-border [&_tr:hover]:bg-transparent";
const TOTAL_ROW_CLASS = "border-t-2 border-border bg-muted";
/** Agrupamento de colunas por superfície sutil; cor não carrega significado aqui. */
const GROUP_CELL_CLASS = "bg-muted/40";
const GROUP_START_CELL_CLASS = "border-l border-border bg-muted/40";
/**
 * Identificação persistente: a primeira coluna acompanha a rolagem horizontal, para
 * que a linha continue identificável no celular sem retirar nenhuma coluna da tabela.
 */
const STICKY_ID_CLASS = "sticky left-0 z-[1] whitespace-normal";
const STICKY_ID_WIDTH = "w-[168px] sm:w-[240px]";

function Section({
  title,
  description,
  actions,
  children,
  bodyClassName,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3.5 md:flex-row md:items-start md:justify-between md:gap-4 md:px-5">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-[1.45] tracking-tight text-foreground">
            {title}
          </h2>
          {description && (
            <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">{actions}</div>
        )}
      </div>
      <div className={cn("p-4 md:p-5", bodyClassName)}>{children}</div>
    </Card>
  );
}

type RowDetailEntry = {
  id: string;
  title: ReactNode;
  lead?: ReactNode;
  items: Array<{ label: string; value: ReactNode }>;
};

/**
 * Acesso ao detalhe no celular.
 *
 * A tabela continua completa e rolável, com a identificação fixa à esquerda. Esta
 * lista é a alternativa acessível para quem não quer rolar na horizontal: mostra
 * identificação e resultado principal e abre todas as colunas da mesma linha, com
 * exatamente os mesmos valores já exibidos na tabela.
 */
function MobileRowDetails({ label, entries }: { label: string; entries: RowDetailEntry[] }) {
  if (!entries.length) return null;
  return (
    <div className="mt-4 md:hidden">
      <p className="text-xs font-semibold text-foreground">{label}</p>
      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
        Abra uma linha para ver todas as colunas sem rolar a tabela.
      </p>
      <div className="mt-2 divide-y divide-border overflow-hidden rounded-md border border-border">
        {entries.map((entry) => (
          <details key={entry.id} className="group bg-card">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
              <span className="min-w-0 flex-1 break-words font-medium text-foreground">
                {entry.title}
              </span>
              {entry.lead && <span className="shrink-0 text-right">{entry.lead}</span>}
              <ChevronDown
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-180"
              />
            </summary>
            <dl className="border-t border-border bg-muted/30 px-3 py-2.5">
              {entry.items.map((item) => (
                <div
                  key={item.label}
                  className="flex items-baseline justify-between gap-3 py-1 text-sm"
                >
                  <dt className="text-xs text-muted-foreground">{item.label}</dt>
                  <dd className="min-w-0 break-words text-right font-medium tabular-nums text-foreground">
                    {item.value}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        ))}
      </div>
    </div>
  );
}

function SectionSkeleton({ title, lines = 6 }: { title: string; lines?: number }) {
  return (
    <Section title={title} description="Carregando os dados do recorte selecionado.">
      <div className="space-y-2" aria-hidden="true">
        <Skeleton className="h-9 w-full" />
        {Array.from({ length: lines }, (_, index) => (
          <Skeleton key={index} className="h-10 w-full" />
        ))}
      </div>
      <p className="sr-only" role="status">
        Carregando {title}.
      </p>
    </Section>
  );
}

export const Route = createFileRoute("/resultados")({
  head: () => ({ meta: [{ title: "Visão resultado — Mapa Parque" }] }),
  component: ResultadosPage,
});

function ResultadosPage() {
  const { selected } = usePartnerFilter();
  const { data: partners = [] } = usePartners();
  const { data: qscData } = useQsc();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [reportSource, setReportSource] = useState<ReportSource | null>(null);
  const [sourceRecords, setSourceRecords] = useState<SourceRecord[]>([]);
  const [bestGuessRecords, setBestGuessRecords] = useState<BestGuessRecord[]>([]);
  const [bestGuessTotal, setBestGuessTotal] = useState<BestGuessTotal>({
    m0MtdPortIn: 0,
    m0MtdPortOut: 0,
    m0MtdSaldo: 0,
    bgFmPortIn: 0,
    bgFmPortOut: 0,
    bgFmSaldo: 0,
  });
  const [analyticalRecords, setAnalyticalRecords] = useState<AnalyticalRecord[]>([]);
  const [completeTowers, setCompleteTowers] = useState<ServiceTower[]>([]);
  const [towerIndex, setTowerIndex] = useState(0);
  const [inputs, setInputs] = useState<Record<string, EditableMetric>>({});
  const [uploadState, setUploadState] = useState<{
    status: "idle" | "loading" | "success" | "error";
    message: string;
  }>({ status: "idle", message: "" });
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => {
    setLoadState("loading");
    setReloadToken((current) => current + 1);
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/data/resultados", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar os resultados persistidos.");
        return response.json() as Promise<RuntimeResults>;
      })
      .then((payload) => {
        if (!active) return;
        setReportSource(payload.resultados.source);
        setSourceRecords(payload.resultados.records);
        setBestGuessRecords(payload.bestGuess.records);
        setBestGuessTotal(payload.bestGuess.total);
        setAnalyticalRecords(payload.portabilidade.records);
        setCompleteTowers(payload.torres.towers);
        setLoadState("ready");
      })
      .catch((error) => {
        if (!active) return;
        setLoadState("error");
        setUploadState({
          status: "error",
          message: error instanceof Error ? error.message : "Falha ao carregar os resultados.",
        });
      });
    return () => {
      active = false;
    };
  }, [reloadToken]);

  const selectedCompanies = useMemo(
    () =>
      new Set(
        selected.map((id) => {
          const partnerName = partners.find((partner) => partner.id === id)?.name ?? id;
          return normalizeCompany(partnerName);
        }),
      ),
    [partners, selected],
  );

  /**
   * Recorte em texto, sem alterar o filtro: nenhuma seleção continua significando
   * consolidado de todos os parceiros, como no comportamento atual do filtro.
   */
  const selectedNames = useMemo(
    () => selected.map((id) => partners.find((partner) => partner.id === id)?.name ?? id),
    [partners, selected],
  );
  const scopeLabel = !selected.length
    ? "Todos os parceiros (consolidado)"
    : selected.length === 1
      ? selectedNames[0]
      : `${selected.length} parceiros selecionados`;

  const scopedRecords = useMemo(() => {
    const sourceRows = selectedCompanies.size
      ? sourceRecords.filter((record) => selectedCompanies.has(normalizeCompany(record.company)))
      : sourceRecords;
    const byProduct = new Map<
      string,
      {
        product: string;
        meta: number;
        real: number;
        attainment: number;
        gap: number;
        average: number;
        previousMeta: number;
        previousReal: number;
        previousAttainment: number;
        previousGap: number;
        previousAverage: number;
        yoy: number;
        yoyGap: number;
        recordCount: number;
      }
    >();

    for (const record of sourceRows) {
      const current = byProduct.get(record.product) ?? {
        product: record.product,
        meta: 0,
        real: 0,
        attainment: 0,
        gap: 0,
        average: 0,
        previousMeta: 0,
        previousReal: 0,
        previousAttainment: 0,
        previousGap: 0,
        previousAverage: 0,
        yoy: 0,
        yoyGap: 0,
        recordCount: 0,
      };
      current.meta += record.meta;
      current.real += record.real;
      current.attainment += record.attainment ?? 0;
      current.gap += record.gap ?? 0;
      current.average += record.average ?? 0;
      current.previousMeta += record.previousMeta;
      current.previousReal += record.previousReal;
      current.previousAttainment += record.previousAttainment ?? 0;
      current.previousGap += record.previousGap ?? 0;
      current.previousAverage += record.previousAverage ?? 0;
      current.yoy += record.yoy ?? 0;
      current.yoyGap += record.yoyGap ?? 0;
      current.recordCount += 1;
      byProduct.set(record.product, current);
    }

    return [...byProduct.values()].map((record) =>
      record.recordCount === 1
        ? record
        : {
            ...record,
            attainment: record.meta > 0 ? record.real / record.meta : 0,
            previousAttainment:
              record.previousMeta > 0 ? record.previousReal / record.previousMeta : 0,
            yoy: record.previousReal > 0 ? record.real / record.previousReal - 1 : 0,
          },
    );
  }, [selectedCompanies, sourceRecords]);

  const scopedBestGuessRecords = useMemo(
    () =>
      selectedCompanies.size
        ? bestGuessRecords.filter((record) =>
            selectedCompanies.has(normalizeCompany(record.company)),
          )
        : bestGuessRecords,
    [bestGuessRecords, selectedCompanies],
  );

  const scopedAnalyticalRecords = useMemo(
    () =>
      selectedCompanies.size
        ? analyticalRecords.filter((record) =>
            selectedCompanies.has(normalizeCompany(record.company)),
          )
        : analyticalRecords,
    [analyticalRecords, selectedCompanies],
  );
  const portabilitySummary = useMemo(
    () => buildPortabilitySummary(scopedAnalyticalRecords),
    [scopedAnalyticalRecords],
  );
  const scopeKey = selected.length
    ? selected.map(normalizeCompany).sort().join("|")
    : "all-companies";

  const rows = useMemo<ResultRow[]>(
    () =>
      scopedRecords.map((record) => {
        const id = `${scopeKey}:${record.product}`;
        const editable = inputs[id] ?? {
          previous: { meta: record.previousMeta, real: record.previousReal },
          current: { meta: record.meta, real: record.real },
        };
        return {
          id,
          product: record.product,
          previousInput: editable.previous,
          currentInput: editable.current,
          previous: {
            attainment: record.previousAttainment,
            gap: record.previousGap,
            average: record.previousAverage,
          },
          current: {
            attainment: record.attainment,
            gap: record.gap,
            average: record.average,
          },
          yoy: record.yoy,
          yoyGap: record.yoyGap,
        };
      }),
    [inputs, scopeKey, scopedRecords],
  );

  const highlights = [
    { product: "Móvel Líquido", label: "Móvel" },
    { product: "Banda Larga", label: "Banda Larga" },
    { product: "Dados Avançados", label: "Dados Avançados" },
  ].flatMap((highlight) => {
    const row = rows.find((item) => item.product === highlight.product);
    return row ? [{ ...highlight, row }] : [];
  });

  const updateValue = (
    product: string,
    period: PeriodKey,
    field: keyof PeriodInput,
    value: string,
  ) => {
    setInputs((current) => ({
      ...current,
      [product]: {
        ...(current[product] ?? { previous: { meta: 0, real: 0 }, current: { meta: 0, real: 0 } }),
        [period]: {
          ...(current[product]?.[period] ?? { meta: 0, real: 0 }),
          [field]: Math.max(0, asNumber(value)),
        },
      },
    }));
  };

  const handleSpreadsheetUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      setUploadState({ status: "error", message: "Anexe uma planilha no formato .xlsx." });
      event.target.value = "";
      return;
    }

    setUploadState({ status: "loading", message: "Lendo a planilha..." });
    try {
      const rows = await readXlsxRows(file);
      const hasAnalyticalHeaders = rows.some((row) => {
        const headers = row.map((value) => normalizeCompany(String(value ?? "")));
        return [
          "grupoeconomico",
          "anomesagendamento",
          "tipoportabilidade",
          "operadora",
          "portinfm",
          "portoutfm",
        ].every((header) => headers.includes(header));
      });
      const hasBestGuessHeaders = rows.some((row) => {
        const headers = row.map((value) => normalizeCompany(String(value ?? "")));
        return [
          "parceiro",
          "m0mtdportin",
          "m0mtdportout",
          "m0mtdsaldo",
          "bgfmportin",
          "bgfmportout",
          "bgfmsaldo",
        ].every((header) => headers.includes(header));
      });
      if (hasAnalyticalHeaders) {
        const importedRecords = recordsFromAnalyticalSpreadsheet(rows);
        setAnalyticalRecords(importedRecords);
        setUploadState({
          status: "success",
          message: `${file.name}: ${importedRecords.length} linhas analíticas atualizadas.`,
        });
      } else if (hasBestGuessHeaders) {
        const imported = recordsFromBestGuessSpreadsheet(rows);
        setBestGuessRecords(imported.records);
        setBestGuessTotal(imported.total);
        setUploadState({
          status: "success",
          message: `${file.name}: ${imported.records.length} parceiros Best Guess atualizados.`,
        });
      } else {
        const importedRecords = recordsFromSpreadsheet(rows);
        setSourceRecords(importedRecords);
        setInputs({});
        setUploadState({
          status: "success",
          message: `${file.name}: ${importedRecords.length} linhas atualizadas.`,
        });
      }
    } catch (error) {
      setUploadState({
        status: "error",
        message: error instanceof Error ? error.message : "Não foi possível processar a planilha.",
      });
    } finally {
      event.target.value = "";
    }
  };

  const loading = loadState === "loading";

  return (
    <DashboardLayout title="Visão resultado">
      <header className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-[1.2] tracking-tight text-foreground md:text-[28px] md:leading-[34px]">
            Visão resultado
          </h1>
          <dl className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <div className="flex min-w-0 items-baseline gap-1.5">
              <dt className="font-medium text-foreground">Recorte:</dt>
              <dd className="min-w-0 truncate" title={selectedNames.join(", ") || undefined}>
                {scopeLabel}
              </dd>
            </div>
            {reportSource?.period && (
              <div className="flex items-baseline gap-1.5">
                <dt className="font-medium text-foreground">Período:</dt>
                <dd>{reportSource.period}</dd>
              </div>
            )}
            {reportSource?.previousPeriod && (
              <div className="flex items-baseline gap-1.5">
                <dt className="font-medium text-foreground">Comparação:</dt>
                <dd>{reportSource.previousPeriod}</dd>
              </div>
            )}
            {reportSource?.monthsElapsed ? (
              <div className="flex items-baseline gap-1.5">
                <dt className="font-medium text-foreground">Meses decorridos:</dt>
                <dd className="tabular-nums">{reportSource.monthsElapsed}</dd>
              </div>
            ) : null}
          </dl>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link to="/relatorio-executivo" search={{ tower: completeTowers[towerIndex]?.id }}>
              <FileDown className="size-4" />
              Relatório executivo
            </Link>
          </Button>
        </div>
      </header>

      {/*
        Importação da planilha: o campo continua acessível por teclado e leitor de
        tela, como antes, agora com nome acessível e com a resposta do processamento
        visível em texto — antes a mensagem era calculada e nunca apresentada.
      */}
      <input
        ref={fileInputRef}
        type="file"
        aria-label="Importar planilha de resultados (.xlsx)"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="sr-only"
        onChange={handleSpreadsheetUpload}
      />
      {uploadState.status !== "idle" && uploadState.message && (
        <p
          role="status"
          className={cn(
            "mb-4 rounded-md border px-3 py-2 text-sm",
            uploadState.status === "error"
              ? "border-destructive/40 bg-destructive/5 text-destructive"
              : "border-border bg-muted text-foreground",
          )}
        >
          {uploadState.message}
        </p>
      )}

      {loadState === "error" ? (
        <ErrorState onRetry={reload} />
      ) : (
        <div className="space-y-6">
          {/*
            Faixa de métricas relacionadas: mesmo YoY importado por produto que já era
            exibido no topo da página, agora com a origem do número explicitada.
          */}
          {loading ? (
            <div className="grid gap-3 sm:grid-cols-3" aria-hidden="true">
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-[88px] w-full" />
              ))}
            </div>
          ) : (
            highlights.length > 0 && (
              <section aria-labelledby="destaques-yoy">
                <h2
                  id="destaques-yoy"
                  className="mb-2 text-[13px] font-semibold text-muted-foreground"
                >
                  Crescimento YoY por produto · valores importados da planilha
                </h2>
                <div className="grid gap-3 sm:grid-cols-3">
                  {highlights.map(({ label, row }) => (
                    <HighlightCard key={label} label={label} yoy={row.yoy} gap={row.yoyGap} />
                  ))}
                </div>
              </section>
            )
          )}
          {loading ? (
            <SectionSkeleton title="Torres de serviço" />
          ) : completeTowers.length ? (
            <ServiceTowersPanel
              key={[...selectedCompanies].sort().join("|")}
              selectedCompanies={selectedCompanies}
              scopeLabel={scopeLabel}
              towers={completeTowers}
              activeIndex={towerIndex}
              onSelect={setTowerIndex}
              onPrevious={() =>
                setTowerIndex(
                  (current) => (current - 1 + completeTowers.length) % completeTowers.length,
                )
              }
              onNext={() => setTowerIndex((current) => (current + 1) % completeTowers.length)}
            />
          ) : (
            <Section title="Torres de serviço">
              <EmptyState
                title="Sem base de torres"
                description="Nenhuma torre de serviço foi importada. Peça a alimentação da base para ver o acompanhamento por parceiro."
              />
            </Section>
          )}
          {loading ? (
            <SectionSkeleton title="Resultado por produto" />
          ) : (
            <PeriodPanel
              rows={rows}
              period="current"
              periodLabel={reportSource?.period}
              previousPeriodLabel={reportSource?.previousPeriod}
              scopeLabel={scopeLabel}
              onUpdate={updateValue}
            />
          )}
          {loading ? (
            <SectionSkeleton title="Portabilidade móvel por parceiro" lines={5} />
          ) : (
            <PortabilityPanel
              records={scopedBestGuessRecords}
              total={selectedCompanies.size ? undefined : bestGuessTotal}
              scoped={selectedCompanies.size > 0}
              scopeLabel={scopeLabel}
            />
          )}
          {loading ? (
            <SectionSkeleton title="Evolução de portabilidade" lines={6} />
          ) : (
            <AnalyticalPortabilityPanel
              summary={portabilitySummary}
              scopeLabel={scopeLabel}
              qscMetric={qscData?.metrics.find((metric) => metric.id === "saldo-portabilidade")}
            />
          )}
        </div>
      )}
    </DashboardLayout>
  );
}

function CertificationPanel({
  rows,
  onUpdate,
}: {
  rows: CertificationRow[];
  onUpdate: (rowId: string, field: CertificationField, value: string) => void;
}) {
  const columns: Array<{
    field: CertificationField;
    label: string;
    width: string;
    numeric?: boolean;
  }> = [
    // Largura dimensionada pelo conteúdo: valores monetários com centavos precisam
    // caber por inteiro, sem reduzir a fonte nem depender de rolagem dentro do campo.
    { field: "jan", label: "Jan", width: "w-[136px]", numeric: true },
    { field: "feb", label: "Fev", width: "w-[136px]", numeric: true },
    { field: "mar", label: "Mar", width: "w-[136px]", numeric: true },
    { field: "apr", label: "Abr", width: "w-[136px]", numeric: true },
    { field: "may", label: "Mai", width: "w-[136px]", numeric: true },
    { field: "jun", label: "Jun", width: "w-[136px]", numeric: true },
    { field: "totalizer", label: "Totalizador", width: "w-[160px]", numeric: true },
    { field: "points", label: "Pts", width: "w-[110px]", numeric: true },
    { field: "band", label: "Faixa", width: "w-[140px]" },
  ];

  return (
    <Card className="overflow-hidden rounded-[2rem] border-violet-500/20 bg-gradient-to-br from-card via-card to-violet-500/[0.045] shadow-elevated">
      <div className="flex items-center gap-3 border-b border-violet-500/15 bg-violet-500/[0.04] px-5 py-5 md:px-7">
        <div className="grid size-10 place-items-center rounded-2xl bg-violet-500/[0.13] text-violet-700 shadow-sm ring-4 ring-background/40 dark:text-violet-300">
          <Award className="size-5" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">
            Resultados comerciais
          </p>
          <h3 className="text-lg font-semibold tracking-tight">Resultado Certificação</h3>
        </div>
      </div>

      <div className="p-3 sm:p-5">
        <TableScroll className="rounded-2xl border border-violet-500/15 bg-background/80 shadow-elegant">
          <Table className="min-w-[1680px] table-fixed">
            <colgroup>
              <col className="w-[340px]" />
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
            <TableBody className="[&_td]:px-2.5 [&_td]:py-3 [&_tr]:border-violet-500/[0.09] [&_tr]:transition-colors [&_tr:hover]:bg-violet-500/[0.035]">
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="px-4 font-semibold text-foreground">
                    {row.indicator}
                  </TableCell>
                  {columns.map((column) => (
                    <TableCell key={column.field} align={column.numeric ? "numeric" : "text"}>
                      <Input
                        aria-label={`${column.label} de ${row.indicator}`}
                        type="text"
                        inputMode={column.numeric ? "decimal" : "text"}
                        value={row[column.field]}
                        onChange={(event) => onUpdate(row.id, column.field, event.target.value)}
                        className={`h-9 rounded-xl border-violet-500/20 bg-violet-500/[0.045] px-2.5 text-sm font-semibold shadow-sm focus-visible:border-violet-500/50 focus-visible:ring-violet-500/15 ${column.numeric ? "text-right tabular-nums" : "text-left"}`}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableScroll>
      </div>
    </Card>
  );
}

function PeriodPanel({
  rows,
  period,
  periodLabel: sourcePeriod,
  previousPeriodLabel,
  scopeLabel,
  onUpdate,
}: {
  rows: ResultRow[];
  period: PeriodKey;
  periodLabel?: string;
  previousPeriodLabel?: string;
  scopeLabel: string;
  onUpdate: (product: string, period: PeriodKey, field: keyof PeriodInput, value: string) => void;
}) {
  const periodLabel = (sourcePeriod ?? "YTD").replace("YTD ", "");
  const calculationKey = period;
  const inputKey = period === "current" ? "currentInput" : "previousInput";
  const totalInput = rows.reduce<PeriodInput>(
    (total, row) => ({
      meta: total.meta + row[inputKey].meta,
      real: total.real + row[inputKey].real,
    }),
    { meta: 0, real: 0 },
  );
  const totalCalculation = rows.reduce<PeriodCalculation>(
    (total, row) => {
      const calculation = row[calculationKey];
      return {
        attainment: total.attainment + calculation.attainment,
        gap: total.gap + calculation.gap,
        average: total.average + calculation.average,
      };
    },
    { attainment: 0, gap: 0, average: 0 },
  );
  totalCalculation.attainment = totalInput.meta > 0 ? totalInput.real / totalInput.meta : 0;
  const totalPrevious = rows.reduce((total, row) => total + row.previousInput.real, 0);
  const totalYoy = totalPrevious > 0 ? totalInput.real / totalPrevious - 1 : null;
  const totalYoyGap = totalInput.real - totalPrevious;

  const description = [
    `Recorte: ${scopeLabel}.`,
    sourcePeriod
      ? `Período importado: ${sourcePeriod}${previousPeriodLabel ? ` · comparação com ${previousPeriodLabel}` : ""}.`
      : null,
    "Meta e Real são editáveis nesta tela e recalculam o Total, o % do Total e o YoY do Total. Por produto, %, Gap TT, Média/mês e YoY são campos importados da planilha e não são recalculados aqui.",
  ]
    .filter(Boolean)
    .join(" ");

  const detailEntries: RowDetailEntry[] = rows.map((row) => {
    const calculation = row[calculationKey];
    const input = row[inputKey];
    return {
      id: `${period}-${row.id}`,
      title: row.product,
      lead: (
        <MetricValue
          value={fmtPct(calculation.attainment)}
          positive={calculation.attainment >= 1}
        />
      ),
      items: [
        { label: "Meta (editável)", value: fmtDec(input.meta) },
        { label: "Real (editável)", value: fmtDec(input.real) },
        { label: "%", value: fmtPct(calculation.attainment) },
        { label: "Gap TT", value: fmtDec(calculation.gap) },
        { label: "Média/mês", value: fmtDec(calculation.average) },
        { label: "YoY R$", value: fmtDec(row.yoyGap) },
        { label: "YoY %", value: row.yoy == null ? "—" : fmtPct(row.yoy) },
      ],
    };
  });
  detailEntries.push({
    id: `${period}-total`,
    title: "Total",
    lead: (
      <MetricValue
        value={fmtPct(totalCalculation.attainment)}
        positive={totalCalculation.attainment >= 1}
      />
    ),
    items: [
      { label: "Meta", value: fmtDec(totalInput.meta) },
      { label: "Real", value: fmtDec(totalInput.real) },
      { label: "%", value: fmtPct(totalCalculation.attainment) },
      { label: "Gap TT", value: fmtDec(totalCalculation.gap) },
      { label: "Média/mês", value: fmtDec(totalCalculation.average) },
      { label: "YoY R$", value: fmtDec(totalYoyGap) },
      { label: "YoY %", value: totalYoy == null ? "—" : fmtPct(totalYoy) },
    ],
  });

  return (
    <Section title="Resultado por produto" description={description} bodyClassName="p-0">
      {rows.length === 0 ? (
        <div className="p-4 md:p-5">
          <EmptyState
            title="Sem resultados no recorte"
            description="Nenhum produto foi encontrado para os parceiros selecionados. Ajuste ou limpe o filtro de parceiros."
          />
        </div>
      ) : (
        <div className="p-4 md:p-5">
          <TableScroll>
            <Table className="min-w-[1106px] table-fixed">
              <colgroup>
                <col className={STICKY_ID_WIDTH} />
                <col className="w-[140px]" />
                <col className="w-[140px]" />
                <col className="w-[96px]" />
                <col className="w-[130px]" />
                <col className="w-[130px]" />
                <col className="w-[140px]" />
                <col className="w-[110px]" />
              </colgroup>
              <TableHeader className={TABLE_HEADER_CLASS}>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={cn(STICKY_ID_CLASS, "bg-muted")}>Produto</TableHead>
                  <TableHead align="numeric">Meta</TableHead>
                  <TableHead align="numeric">Real</TableHead>
                  <TableHead align="numeric">%</TableHead>
                  <TableHead align="numeric">Gap TT</TableHead>
                  <TableHead align="numeric">Média/mês</TableHead>
                  <TableHead align="numeric" className={GROUP_START_CELL_CLASS}>
                    YoY R$
                  </TableHead>
                  <TableHead align="numeric" className={GROUP_CELL_CLASS}>
                    YoY %
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className={TABLE_BODY_CLASS}>
                {rows.map((row) => {
                  const calculation = row[calculationKey];
                  const input = row[inputKey];
                  return (
                    <TableRow key={`${period}-${row.id}`}>
                      <TableCell
                        className={cn(STICKY_ID_CLASS, "bg-card font-medium text-foreground")}
                      >
                        {row.product}
                      </TableCell>
                      <EditableNumberCell
                        ariaLabel={`Meta ${periodLabel} de ${row.product}`}
                        value={input.meta}
                        onChange={(value) => onUpdate(row.id, period, "meta", value)}
                      />
                      <EditableNumberCell
                        ariaLabel={`Real ${periodLabel} de ${row.product}`}
                        value={input.real}
                        onChange={(value) => onUpdate(row.id, period, "real", value)}
                      />
                      <TableCell align="numeric">
                        <MetricValue
                          value={fmtPct(calculation.attainment)}
                          positive={calculation.attainment >= 1}
                        />
                      </TableCell>
                      <TableCell align="numeric">
                        <MetricValue
                          value={fmtDec(calculation.gap)}
                          positive={calculation.gap >= 0}
                        />
                      </TableCell>
                      <TableCell align="numeric" className="font-medium text-foreground">
                        {fmtDec(calculation.average)}
                      </TableCell>
                      <TableCell align="numeric" className={GROUP_START_CELL_CLASS}>
                        <MetricValue value={fmtDec(row.yoyGap)} positive={row.yoyGap >= 0} />
                      </TableCell>
                      <TableCell align="numeric" className={GROUP_CELL_CLASS}>
                        <MetricValue
                          value={row.yoy == null ? "—" : fmtPct(row.yoy)}
                          positive={row.yoy != null && row.yoy >= 0}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
                <TableRow className={TOTAL_ROW_CLASS}>
                  <TableCell
                    className={cn(STICKY_ID_CLASS, "bg-muted font-semibold text-foreground")}
                  >
                    Total
                  </TableCell>
                  <TableCell align="numeric" className="font-semibold text-foreground">
                    {fmtDec(totalInput.meta)}
                  </TableCell>
                  <TableCell align="numeric" className="font-semibold text-foreground">
                    {fmtDec(totalInput.real)}
                  </TableCell>
                  <TableCell align="numeric">
                    <MetricValue
                      value={fmtPct(totalCalculation.attainment)}
                      positive={totalCalculation.attainment >= 1}
                    />
                  </TableCell>
                  <TableCell align="numeric">
                    <MetricValue
                      value={fmtDec(totalCalculation.gap)}
                      positive={totalCalculation.gap >= 0}
                    />
                  </TableCell>
                  <TableCell align="numeric" className="font-semibold text-foreground">
                    {fmtDec(totalCalculation.average)}
                  </TableCell>
                  <TableCell align="numeric" className={GROUP_START_CELL_CLASS}>
                    <MetricValue value={fmtDec(totalYoyGap)} positive={totalYoyGap >= 0} />
                  </TableCell>
                  <TableCell align="numeric" className={GROUP_CELL_CLASS}>
                    <MetricValue
                      value={totalYoy == null ? "—" : fmtPct(totalYoy)}
                      positive={totalYoy != null && totalYoy >= 0}
                    />
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableScroll>
          <MobileRowDetails label="Detalhe por produto" entries={detailEntries} />
        </div>
      )}
    </Section>
  );
}

function PortabilityPanel({
  records,
  total: sourceTotal,
  scoped,
  scopeLabel,
}: {
  records: BestGuessRecord[];
  total?: BestGuessTotal;
  scoped: boolean;
  scopeLabel: string;
}) {
  const total =
    sourceTotal ??
    records.reduce<BestGuessTotal>(
      (sum, record) => {
        sum.m0MtdPortIn += record.m0MtdPortIn;
        sum.m0MtdPortOut += record.m0MtdPortOut;
        sum.m0MtdSaldo += record.m0MtdSaldo;
        sum.bgFmPortIn += record.bgFmPortIn;
        sum.bgFmPortOut += record.bgFmPortOut;
        sum.bgFmSaldo += record.bgFmSaldo;
        return sum;
      },
      {
        m0MtdPortIn: 0,
        m0MtdPortOut: 0,
        m0MtdSaldo: 0,
        bgFmPortIn: 0,
        bgFmPortOut: 0,
        bgFmSaldo: 0,
      },
    );
  const valueCell = (value: number, className?: string) => (
    <TableCell
      align="numeric"
      className={cn("font-medium", value < 0 ? "text-destructive" : "text-foreground", className)}
    >
      {fmtDec(value)}
    </TableCell>
  );
  /**
   * Escopo explícito do totalizador: com parceiros selecionados, o total é a soma do
   * recorte; sem seleção, é o total da própria base Best Guess importada.
   */
  const totalLabel = scoped ? "Total do recorte" : "Total geral";
  const detailItems = (values: BestGuessTotal) => [
    { label: "M0 MTD Port-In", value: fmtDec(values.m0MtdPortIn) },
    { label: "M0 MTD Port-Out", value: fmtDec(values.m0MtdPortOut) },
    { label: "M0 MTD Saldo", value: fmtDec(values.m0MtdSaldo) },
    { label: "BG FM Port-In", value: fmtDec(values.bgFmPortIn) },
    { label: "BG FM Port-Out", value: fmtDec(values.bgFmPortOut) },
    { label: "BG FM Saldo", value: fmtDec(values.bgFmSaldo) },
  ];
  const detailEntries: RowDetailEntry[] = [
    ...records.map((record) => ({
      id: record.company,
      title: record.company,
      lead: <MetricValue value={fmtDec(record.bgFmSaldo)} positive={record.bgFmSaldo >= 0} />,
      items: detailItems(record),
    })),
    {
      id: "__total__",
      title: totalLabel,
      lead: <MetricValue value={fmtDec(total.bgFmSaldo)} positive={total.bgFmSaldo >= 0} />,
      items: detailItems(total),
    },
  ];

  return (
    <Section
      title="Portabilidade móvel por parceiro"
      description={`Recorte: ${scopeLabel}. Valores importados da base Best Guess: M0 MTD é o acumulado do mês e BG FM é a projeção de fechamento. ${scoped ? "Com parceiros selecionados, o total é a soma do recorte." : "Sem seleção, o total é o da base importada."}`}
      bodyClassName="p-0"
    >
      <div className="p-4 md:p-5">
        {records.length === 0 ? (
          <EmptyState
            title="Sem parceiros no recorte"
            description="A base Best Guess não tem linhas para os parceiros selecionados. Ajuste ou limpe o filtro de parceiros."
          />
        ) : (
          <>
            <TableScroll>
              <Table className="min-w-[1008px] table-fixed">
                <colgroup>
                  <col className={STICKY_ID_WIDTH} />
                  <col className="w-[128px]" />
                  <col className="w-[128px]" />
                  <col className="w-[128px]" />
                  <col className="w-[128px]" />
                  <col className="w-[128px]" />
                  <col className="w-[128px]" />
                </colgroup>
                <TableHeader className={TABLE_HEADER_CLASS}>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={cn(STICKY_ID_CLASS, "bg-muted")}>Parceiro</TableHead>
                    <TableHead align="numeric">M0 MTD Port-In</TableHead>
                    <TableHead align="numeric">M0 MTD Port-Out</TableHead>
                    <TableHead align="numeric">M0 MTD Saldo</TableHead>
                    <TableHead align="numeric" className={GROUP_START_CELL_CLASS}>
                      BG FM Port-In
                    </TableHead>
                    <TableHead align="numeric" className={GROUP_CELL_CLASS}>
                      BG FM Port-Out
                    </TableHead>
                    <TableHead align="numeric" className={GROUP_CELL_CLASS}>
                      BG FM Saldo
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className={TABLE_BODY_CLASS}>
                  {records.map((record) => (
                    <TableRow key={record.company}>
                      <TableCell
                        className={cn(STICKY_ID_CLASS, "bg-card font-medium text-foreground")}
                        title={record.company}
                      >
                        {record.company}
                      </TableCell>
                      {valueCell(record.m0MtdPortIn)}
                      {valueCell(record.m0MtdPortOut)}
                      {valueCell(record.m0MtdSaldo)}
                      {valueCell(record.bgFmPortIn, GROUP_START_CELL_CLASS)}
                      {valueCell(record.bgFmPortOut, GROUP_CELL_CLASS)}
                      {valueCell(record.bgFmSaldo, GROUP_CELL_CLASS)}
                    </TableRow>
                  ))}
                  <TableRow className={TOTAL_ROW_CLASS}>
                    <TableCell
                      className={cn(STICKY_ID_CLASS, "bg-muted font-semibold text-foreground")}
                    >
                      {totalLabel}
                    </TableCell>
                    {valueCell(total.m0MtdPortIn, "font-semibold")}
                    {valueCell(total.m0MtdPortOut, "font-semibold")}
                    {valueCell(total.m0MtdSaldo, "font-semibold")}
                    {valueCell(total.bgFmPortIn, cn(GROUP_START_CELL_CLASS, "font-semibold"))}
                    {valueCell(total.bgFmPortOut, cn(GROUP_CELL_CLASS, "font-semibold"))}
                    {valueCell(total.bgFmSaldo, cn(GROUP_CELL_CLASS, "font-semibold"))}
                  </TableRow>
                </TableBody>
              </Table>
            </TableScroll>
            <MobileRowDetails label="Detalhe por parceiro" entries={detailEntries} />
          </>
        )}
      </div>
    </Section>
  );
}

function AnalyticalPortabilityPanel({
  summary,
  scopeLabel,
  qscMetric,
}: {
  summary: { rows: PortabilitySummaryRow[]; total: PortabilitySummaryTotal };
  scopeLabel: string;
  qscMetric?: import("@/lib/qsc").QscMetricSeries;
}) {
  const { rows, total } = summary;
  const qscByCompetence = new Map(
    (qscMetric?.history ?? []).map((point) => [point.competence, point]),
  );
  const qscPointForMonth = (month: number) =>
    qscByCompetence.get(`${Math.trunc(month / 100)}-${String(month % 100).padStart(2, "0")}`);
  const qscPoints = rows.flatMap((row) => {
    const point = qscPointForMonth(row.month);
    return point?.available ? [point] : [];
  });
  const qscTotal = qscPoints.length
    ? qscPoints.reduce(
        (result, point) => ({
          numerator: result.numerator + point.numerator,
          denominator: result.denominator + point.denominator,
        }),
        { numerator: 0, denominator: 0 },
      )
    : null;
  const periodLabel = rows.length
    ? `${rows[0].label} a ${rows[rows.length - 1].label}`
    : "Sem período disponível";
  /**
   * Cor só onde há significado comercial: volumes de PortIn e PortOut ficam neutros,
   * porque "maior" não é favorável por si só. Saldo e conversão mantêm a leitura
   * favorável/desfavorável que a operação já usava.
   */
  const indicator = (
    label: string,
    value: number | null,
    format: "integer" | "percent" = "integer",
    tone: "neutral" | "semantic" = "neutral",
  ) => {
    const displayValue =
      value == null ? "—" : format === "percent" ? fmtPct(value) : formatInteger(value);
    const valueClass =
      value == null
        ? "text-muted-foreground"
        : tone === "semantic"
          ? value >= 0
            ? "text-success"
            : "text-destructive"
          : "text-foreground";
    return (
      <div className="rounded-md border border-border p-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className={cn("mt-1 text-2xl font-semibold tracking-tight tabular-nums", valueClass)}>
          {displayValue}
        </p>
      </div>
    );
  };
  const leaderCell = (operator: string) => (
    <TableCell className="whitespace-normal break-words font-medium text-foreground">
      {operator}
    </TableCell>
  );
  const saldoCell = (value: number) => (
    <TableCell align="numeric">
      <MetricValue value={formatInteger(value)} positive={value >= 0} />
    </TableCell>
  );
  const conversionCell = (value: number | null) => (
    <TableCell align="numeric">
      <MetricValue
        value={value == null ? "—" : fmtPct(value)}
        positive={value != null && value >= 0}
      />
    </TableCell>
  );
  const qscNumberCell = (value?: number, className?: string) => (
    <TableCell align="numeric" className={cn("font-medium text-foreground", className)}>
      {value == null ? "—" : formatInteger(value)}
    </TableCell>
  );
  const qscPercentCell = (numerator?: number, denominator?: number, className?: string) => (
    <TableCell align="numeric" className={cn("font-medium text-foreground", className)}>
      {numerator == null || denominator == null || denominator <= 0
        ? "—"
        : fmtPct(numerator / denominator)}
    </TableCell>
  );
  const qscValue = (value?: number) => (value == null ? "—" : formatInteger(value));
  const qscPercentValue = (numerator?: number, denominator?: number) =>
    numerator == null || denominator == null || denominator <= 0
      ? "—"
      : fmtPct(numerator / denominator);
  const detailEntries: RowDetailEntry[] = [
    ...rows.map((row) => {
      const qscPoint = qscPointForMonth(row.month);
      const numerator = qscPoint?.available ? qscPoint.numerator : undefined;
      const denominator = qscPoint?.available ? qscPoint.denominator : undefined;
      return {
        id: String(row.month),
        title: row.label,
        lead: <MetricValue value={formatInteger(row.saldo)} positive={row.saldo >= 0} />,
        items: [
          { label: "PortIn total", value: formatInteger(row.portIn) },
          { label: "PortOut total", value: formatInteger(row.portOut) },
          { label: "Saldo líquido", value: formatInteger(row.saldo) },
          { label: "%", value: row.conversion == null ? "—" : fmtPct(row.conversion) },
          { label: "Saldo QSC", value: qscValue(numerator) },
          { label: "Altas", value: qscValue(denominator) },
          { label: "% QSC", value: qscPercentValue(numerator, denominator) },
          { label: "Operadora líder em PortIn", value: row.leaderPortIn },
          { label: "Volume de PortIn", value: formatInteger(row.leaderPortInVolume) },
          { label: "Operadora líder em PortOut", value: row.leaderPortOut },
          { label: "Volume de PortOut", value: formatInteger(row.leaderPortOutVolume) },
        ],
      };
    }),
    {
      id: "__total__",
      title: "Total acumulado",
      lead: <MetricValue value={formatInteger(total.saldo)} positive={total.saldo >= 0} />,
      items: [
        { label: "PortIn total", value: formatInteger(total.portIn) },
        { label: "PortOut total", value: formatInteger(total.portOut) },
        { label: "Saldo líquido", value: formatInteger(total.saldo) },
        { label: "%", value: total.conversion == null ? "—" : fmtPct(total.conversion) },
        { label: "Saldo QSC", value: qscValue(qscTotal?.numerator) },
        { label: "Altas", value: qscValue(qscTotal?.denominator) },
        { label: "% QSC", value: qscPercentValue(qscTotal?.numerator, qscTotal?.denominator) },
        { label: "Operadora líder em PortIn", value: total.leaderPortIn },
        { label: "Volume de PortIn", value: formatInteger(total.leaderPortInVolume) },
        { label: "Operadora líder em PortOut", value: total.leaderPortOut },
        { label: "Volume de PortOut", value: formatInteger(total.leaderPortOutVolume) },
      ],
    },
  ];

  return (
    <Section
      title="Evolução de portabilidade"
      description={`Recorte: ${scopeLabel}. Série mensal calculada a partir da base analítica importada (últimos ${rows.length} meses: ${periodLabel}). Saldo QSC, Altas e % QSC vêm do indicador Saldo de portabilidade do QSC; meses sem apuração aparecem como “—”, e não como zero.`}
      bodyClassName="p-0"
    >
      <div className="p-4 md:p-5">
        {rows.length === 0 ? (
          <EmptyState
            title="Sem meses disponíveis"
            description="A base analítica não tem linhas para os parceiros selecionados. Ajuste ou limpe o filtro de parceiros."
          />
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {indicator("PortIn acumulado", total.portIn)}
              {indicator("PortOut acumulado", total.portOut)}
              {indicator("Saldo líquido acumulado", total.saldo, "integer", "semantic")}
              {indicator("Conversão de portabilidade", total.conversion, "percent", "semantic")}
            </div>
            <TableScroll>
              <Table className="min-w-[1732px] table-fixed">
                <colgroup>
                  <col className={STICKY_ID_WIDTH} />
                  <col className="w-[124px]" />
                  <col className="w-[128px]" />
                  <col className="w-[124px]" />
                  <col className="w-[96px]" />
                  <col className="w-[116px]" />
                  <col className="w-[104px]" />
                  <col className="w-[104px]" />
                  <col className="w-[200px]" />
                  <col className="w-[140px]" />
                  <col className="w-[208px]" />
                  <col className="w-[148px]" />
                </colgroup>
                <TableHeader className={TABLE_HEADER_CLASS}>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={cn(STICKY_ID_CLASS, "bg-muted")}>Mês</TableHead>
                    <TableHead align="numeric">PortIn total</TableHead>
                    <TableHead align="numeric">PortOut total</TableHead>
                    <TableHead align="numeric">Saldo líquido</TableHead>
                    <TableHead align="numeric">%</TableHead>
                    <TableHead align="numeric" className={GROUP_START_CELL_CLASS}>
                      Saldo QSC
                    </TableHead>
                    <TableHead align="numeric" className={GROUP_CELL_CLASS}>
                      Altas
                    </TableHead>
                    <TableHead align="numeric" className={GROUP_CELL_CLASS}>
                      % QSC
                    </TableHead>
                    <TableHead>Operadora líder em PortIn</TableHead>
                    <TableHead align="numeric">Volume de PortIn</TableHead>
                    <TableHead>Operadora líder em PortOut</TableHead>
                    <TableHead align="numeric">Volume de PortOut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className={TABLE_BODY_CLASS}>
                  {rows.map((row) => {
                    const qscPoint = qscPointForMonth(row.month);
                    return (
                      <TableRow key={row.month}>
                        <TableCell
                          className={cn(STICKY_ID_CLASS, "bg-card font-medium text-foreground")}
                        >
                          {row.label}
                        </TableCell>
                        <TableCell align="numeric" className="font-medium text-foreground">
                          {formatInteger(row.portIn)}
                        </TableCell>
                        <TableCell align="numeric" className="font-medium text-foreground">
                          {formatInteger(row.portOut)}
                        </TableCell>
                        {saldoCell(row.saldo)}
                        {conversionCell(row.conversion)}
                        {qscNumberCell(
                          qscPoint?.available ? qscPoint.numerator : undefined,
                          GROUP_START_CELL_CLASS,
                        )}
                        {qscNumberCell(
                          qscPoint?.available ? qscPoint.denominator : undefined,
                          GROUP_CELL_CLASS,
                        )}
                        {qscPercentCell(
                          qscPoint?.available ? qscPoint.numerator : undefined,
                          qscPoint?.available ? qscPoint.denominator : undefined,
                          GROUP_CELL_CLASS,
                        )}
                        {leaderCell(row.leaderPortIn)}
                        <TableCell align="numeric" className="font-medium text-foreground">
                          {formatInteger(row.leaderPortInVolume)}
                        </TableCell>
                        {leaderCell(row.leaderPortOut)}
                        <TableCell align="numeric" className="font-medium text-foreground">
                          {formatInteger(row.leaderPortOutVolume)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className={TOTAL_ROW_CLASS}>
                    <TableCell
                      className={cn(STICKY_ID_CLASS, "bg-muted font-semibold text-foreground")}
                    >
                      Total acumulado
                    </TableCell>
                    <TableCell align="numeric" className="font-semibold text-foreground">
                      {formatInteger(total.portIn)}
                    </TableCell>
                    <TableCell align="numeric" className="font-semibold text-foreground">
                      {formatInteger(total.portOut)}
                    </TableCell>
                    {saldoCell(total.saldo)}
                    {conversionCell(total.conversion)}
                    {qscNumberCell(qscTotal?.numerator, GROUP_START_CELL_CLASS)}
                    {qscNumberCell(qscTotal?.denominator, GROUP_CELL_CLASS)}
                    {qscPercentCell(qscTotal?.numerator, qscTotal?.denominator, GROUP_CELL_CLASS)}
                    {leaderCell(total.leaderPortIn)}
                    <TableCell align="numeric" className="font-semibold text-foreground">
                      {formatInteger(total.leaderPortInVolume)}
                    </TableCell>
                    {leaderCell(total.leaderPortOut)}
                    <TableCell align="numeric" className="font-semibold text-foreground">
                      {formatInteger(total.leaderPortOutVolume)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableScroll>
            <MobileRowDetails label="Detalhe por mês" entries={detailEntries} />
          </div>
        )}
      </div>
    </Section>
  );
}

function ServiceTowersPanel({
  towers,
  selectedCompanies,
  scopeLabel,
  activeIndex,
  onSelect,
  onPrevious,
  onNext,
}: {
  towers: ServiceTower[];
  selectedCompanies: Set<string>;
  scopeLabel: string;
  activeIndex: number;
  onSelect: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const [expandedFocus, setExpandedFocus] = useState<string | null>(null);
  const focusKey = `${activeIndex}:${[...selectedCompanies].sort().join("|")}`;
  const showOthers = expandedFocus === focusKey;
  const tower = towers[activeIndex] ?? towers[0];
  if (!tower) return null;
  const rankingColumns = ["bgxpc", "meta", "estxpc"].flatMap((label) =>
    tower.columns.filter((column) => normalizeCompany(column.label) === label),
  );
  const rankedRows = [...tower.rows].sort((left, right) => {
    for (const column of rankingColumns) {
      const a = left.values[column.key];
      const b = right.values[column.key];
      const aValue = typeof a === "number" && Number.isFinite(a) ? a : -Infinity;
      const bValue = typeof b === "number" && Number.isFinite(b) ? b : -Infinity;
      if (aValue !== bValue) return aValue > bValue ? -1 : 1;
    }
    return rankingColumns.length ? left.partner.localeCompare(right.partner, "pt-BR") : 0;
  });
  const positions = new Map(rankedRows.map((row, index) => [row, index + 1]));
  const focused = selectedCompanies.size > 0;
  const focusedRows = rankedRows.filter((row) =>
    selectedCompanies.has(normalizeCompany(row.partner)),
  );
  const otherRows = rankedRows.filter(
    (row) => !selectedCompanies.has(normalizeCompany(row.partner)),
  );
  const displayedRows = focused ? [...focusedRows, ...(showOthers ? otherRows : [])] : rankedRows;
  const visibleColumns = tower.columns.filter(
    (column) =>
      !(
        ["vvn", "ti-recorrente"].includes(tower.id) &&
        column.label.trim().toUpperCase() === "BEST GUESS"
      ),
  );
  const showValue = (value: string | number | null, format: string) => {
    if (value == null) return "—";
    if (typeof value === "string") return value;
    return format === "percent" ? fmtPct(value) : fmtDec(value);
  };
  const performanceClass = (value: string | number | null, format: string) => {
    if (format !== "percent" || typeof value !== "number") return "text-foreground";
    if (value <= 0.5) return "font-semibold text-destructive";
    if (value < 0.8) return "font-semibold text-warning";
    if (value > 0.9) return "font-semibold text-success";
    return "text-foreground";
  };
  const showPerformance = (
    value: string | number | null,
    column: ServiceTower["columns"][number],
  ) => {
    const formatted = showValue(value, column.format);
    if (
      ["forecast", "esteira", "ativado", "recbruta", "recliquida", "emissoes"].includes(
        normalizeCompany(column.label),
      )
    ) {
      return <span className="font-semibold tabular-nums text-foreground">{formatted}</span>;
    }
    if (
      !["bgxpc", "meta", "estxpc"].includes(normalizeCompany(column.label)) ||
      typeof value !== "number" ||
      !Number.isFinite(value)
    )
      return formatted;
    const neutral = value >= 0.8 && value <= 0.9;
    const Icon = neutral ? ArrowRight : value > 0.9 ? TrendingUp : TrendingDown;
    const color = neutral
      ? "text-foreground"
      : value > 0.9
        ? "text-success"
        : value <= 0.5
          ? "text-destructive"
          : "text-critical";
    return (
      <span
        className={`inline-flex items-center justify-end gap-1.5 font-semibold tabular-nums ${color}`}
      >
        <Icon className="size-3.5" aria-hidden="true" />
        {formatted}
      </span>
    );
  };

  const rankingLabels: Record<string, string> = {};
  for (const column of rankingColumns) rankingLabels[column.key] = column.label;
  const leadColumn = rankingColumns[0] ?? visibleColumns[0];
  const detailEntries: RowDetailEntry[] = [
    ...displayedRows.map((row) => ({
      id: `${tower.id}-${row.partner}`,
      title: rankingColumns.length > 0 ? `${positions.get(row)}º · ${row.partner}` : row.partner,
      lead: leadColumn ? showPerformance(row.values[leadColumn.key], leadColumn) : undefined,
      items: visibleColumns.map((column) => ({
        label: column.label,
        value: showPerformance(row.values[column.key], column),
      })),
    })),
    {
      id: `${tower.id}-total`,
      title: focused ? "TT · Todos os parceiros" : "TT",
      lead: leadColumn ? showPerformance(tower.total[leadColumn.key], leadColumn) : undefined,
      items: visibleColumns.map((column) => ({
        label: column.label,
        value: showPerformance(tower.total[column.key], column),
      })),
    },
  ];
  const rankingDescription = rankingColumns.length
    ? `Ranking decrescente por ${rankingColumns.map((column) => column.label).join(", ")}, com desempate por nome.`
    : "Esta torre não possui colunas de ranking; a ordem é a da base importada.";

  return (
    <Section
      title="Torres de serviço"
      description={`Recorte: ${scopeLabel}. ${rankingDescription} Valores importados da base de torres; a seta indica a faixa de atingimento e a linha TT permanece com o total de todos os parceiros disponíveis no escopo autorizado.`}
      actions={
        <>
          <span className="text-xs font-medium tabular-nums text-muted-foreground">
            {activeIndex + 1} / {towers.length}
          </span>
          <Button type="button" variant="outline" size="icon" onClick={onPrevious}>
            <ChevronLeft className="size-4" />
            <span className="sr-only">Torre anterior</span>
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={onNext}>
            <ChevronRight className="size-4" />
            <span className="sr-only">Próxima torre</span>
          </Button>
        </>
      }
      bodyClassName="p-0"
    >
      <div className="p-4 md:p-5">
        <div className="flex flex-wrap gap-1.5" aria-label="Seleção de torre de serviço">
          {towers.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(index)}
              aria-current={index === activeIndex ? "true" : undefined}
              className={cn(
                "rounded-sm border px-3 py-2 text-xs font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                index === activeIndex
                  ? "border-primary bg-selection font-semibold text-primary"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {item.title}
            </button>
          ))}
        </div>
        {focused && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-muted px-3 py-2">
            <span className="text-sm text-foreground">
              Modo foco · {focusedRows.length} parceiro(s) selecionado(s)
            </span>
            {otherRows.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-expanded={showOthers}
                onClick={() => setExpandedFocus(showOthers ? null : focusKey)}
              >
                {showOthers
                  ? "Recolher demais parceiros"
                  : `Expandir demais parceiros (${otherRows.length})`}
              </Button>
            )}
          </div>
        )}
        <div className="mt-4">
          <TableScroll>
            <Table className="min-w-max table-fixed">
              <TableHeader className={TABLE_HEADER_CLASS}>
                <TableRow className="hover:bg-transparent">
                  <TableHead
                    className={cn(
                      STICKY_ID_CLASS,
                      STICKY_ID_WIDTH,
                      "min-w-[168px] max-w-[168px] bg-muted sm:min-w-[240px] sm:max-w-[240px]",
                    )}
                  >
                    NM_REDE
                  </TableHead>
                  {visibleColumns.map((column) => (
                    <TableHead key={column.key} align="numeric" className="min-w-[116px]">
                      {column.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody className={cn(TABLE_BODY_CLASS, "[&_td:first-child]:whitespace-normal")}>
                {focused && focusedRows.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={visibleColumns.length + 1}
                      className="text-center text-muted-foreground"
                    >
                      Nenhum dado para os parceiros selecionados nesta torre.
                    </TableCell>
                  </TableRow>
                )}
                {displayedRows.map((row) => {
                  const highlighted =
                    focused && selectedCompanies.has(normalizeCompany(row.partner));
                  return (
                    <TableRow
                      key={`${tower.id}-${row.partner}`}
                      className={highlighted ? "bg-selection" : undefined}
                    >
                      {/* Identificação com largura própria: o nome longo quebra dentro da
                          coluna em vez de invadir os números da linha, e acompanha a
                          rolagem horizontal para não se perder no celular. */}
                      <TableCell
                        className={cn(
                          STICKY_ID_CLASS,
                          STICKY_ID_WIDTH,
                          "min-w-[168px] max-w-[168px] align-middle font-medium text-foreground sm:min-w-[240px] sm:max-w-[240px]",
                          highlighted ? "bg-selection" : "bg-card",
                        )}
                      >
                        <span className="flex items-start gap-2">
                          {rankingColumns.length > 0 && (
                            <span className="mt-px inline-flex min-w-6 shrink-0 justify-center rounded-sm bg-muted px-1 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                              {positions.get(row)}º
                            </span>
                          )}
                          <span className="min-w-0 break-words leading-snug" title={row.partner}>
                            {row.partner}
                          </span>
                        </span>
                      </TableCell>
                      {visibleColumns.map((column) => (
                        <TableCell
                          key={column.key}
                          align="numeric"
                          className={performanceClass(row.values[column.key], column.format)}
                        >
                          {showPerformance(row.values[column.key], column)}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
                {focused && otherRows.length > 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={visibleColumns.length + 1} className="p-0">
                      <div className="sticky left-0 w-fit px-3 py-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setExpandedFocus(showOthers ? null : focusKey)}
                          aria-expanded={showOthers}
                        >
                          {showOthers
                            ? "Recolher demais parceiros"
                            : `Expandir demais parceiros (${otherRows.length})`}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className={TOTAL_ROW_CLASS}>
                  <TableCell
                    className={cn(
                      STICKY_ID_CLASS,
                      STICKY_ID_WIDTH,
                      "min-w-[168px] max-w-[168px] bg-muted font-semibold text-foreground sm:min-w-[240px] sm:max-w-[240px]",
                    )}
                  >
                    {focused ? "TT · Todos os parceiros" : "TT"}
                  </TableCell>
                  {visibleColumns.map((column) => (
                    <TableCell
                      key={column.key}
                      align="numeric"
                      className={cn(
                        "font-semibold",
                        performanceClass(tower.total[column.key], column.format),
                      )}
                    >
                      {showPerformance(tower.total[column.key], column)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </TableScroll>
          <MobileRowDetails label="Detalhe por parceiro" entries={detailEntries} />
        </div>
      </div>
    </Section>
  );
}

function YoyPanel({ rows }: { rows: ResultRow[] }) {
  const totalPrevious = rows.reduce((total, row) => total + row.previousInput.real, 0);
  const totalCurrent = rows.reduce((total, row) => total + row.currentInput.real, 0);
  const totalYoy = totalPrevious > 0 ? totalCurrent / totalPrevious - 1 : null;
  const totalGap = totalCurrent - totalPrevious;
  return (
    <Card className="overflow-hidden rounded-[2rem] border-cyan/20 bg-gradient-to-br from-card via-card to-cyan/[0.065] shadow-elevated">
      <div className="flex items-center gap-3 border-b border-cyan/15 bg-cyan/[0.045] px-5 py-5 md:px-7">
        <div className="grid size-10 place-items-center rounded-2xl bg-cyan/[0.13] text-cyan shadow-sm">
          <TrendingUp className="size-5" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan">
            Comparação entre períodos
          </p>
          <h3 className="text-lg font-semibold tracking-tight">Tabela YoY</h3>
        </div>
      </div>
      <div className="p-3 sm:p-5">
        <div className="overflow-x-auto rounded-2xl border border-cyan/15 bg-background/80 shadow-elegant">
          <Table className="min-w-[820px] table-fixed">
            <colgroup>
              <col className="w-[300px]" />
              <col className="w-[150px]" />
              <col className="w-[150px]" />
              <col className="w-[120px]" />
              <col className="w-[150px]" />
            </colgroup>
            <TableHeader className="bg-cyan/[0.045] [&_th]:h-auto [&_th]:px-4 [&_th]:py-3.5 [&_th]:text-[10px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.13em] [&_th]:text-muted-foreground">
              <TableRow className="hover:bg-transparent">
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Real 2025</TableHead>
                <TableHead className="text-right">Real 2026</TableHead>
                <TableHead className="text-right">YoY %</TableHead>
                <TableHead className="text-right">YoY Gap</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="[&_td]:px-4 [&_td]:py-3.5 [&_tr]:border-cyan/[0.1] [&_tr]:transition-colors [&_tr:hover]:bg-cyan/[0.035]">
              {rows.map((row) => (
                <TableRow key={`yoy-${row.product}`}>
                  <TableCell className="font-semibold text-foreground">{row.product}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-muted-foreground">
                    {fmtDec(row.previousInput.real)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-foreground">
                    {fmtDec(row.currentInput.real)}
                  </TableCell>
                  <TableCell className="text-right">
                    <MetricValue
                      value={row.yoy == null ? "—" : fmtPct(row.yoy)}
                      positive={row.yoy != null && row.yoy >= 0}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <MetricValue value={fmtDec(row.yoyGap)} positive={row.yoyGap >= 0} />
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 border-cyan/20 bg-cyan/[0.04]">
                <TableCell className="font-semibold text-foreground">Total</TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-foreground">
                  {fmtDec(totalPrevious)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-foreground">
                  {fmtDec(totalCurrent)}
                </TableCell>
                <TableCell className="text-right">
                  <MetricValue
                    value={totalYoy == null ? "—" : fmtPct(totalYoy)}
                    positive={totalYoy != null && totalYoy >= 0}
                  />
                </TableCell>
                <TableCell className="text-right">
                  <MetricValue value={fmtDec(totalGap)} positive={totalGap >= 0} />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </Card>
  );
}

/**
 * Célula editável.
 *
 * Campo discreto com borda e foco do próprio primitivo: sem cápsula colorida, para
 * que "editável" se distinga de "valor calculado" pela forma, não pela cor de fundo.
 * A leitura, o parsing e o arredondamento continuam idênticos.
 */
function EditableNumberCell({
  ariaLabel,
  value,
  onChange,
}: {
  ariaLabel: string;
  value: number;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(() => formatInputNumber(value));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setDraft(formatInputNumber(value));
  }, [focused, value]);

  return (
    <TableCell align="numeric">
      <Input
        aria-label={ariaLabel}
        type="text"
        inputMode="decimal"
        value={draft}
        onFocus={(event) => {
          setFocused(true);
          event.currentTarget.select();
        }}
        onChange={(event) => {
          setDraft(event.target.value);
          onChange(String(Math.max(0, parseInputNumber(event.target.value))));
        }}
        onBlur={() => {
          setFocused(false);
          const parsed = Math.max(0, parseInputNumber(draft));
          setDraft(formatInputNumber(parsed));
          onChange(String(parsed));
        }}
        className="h-9 w-full px-2 text-right text-sm font-medium tabular-nums md:text-sm"
      />
    </TableCell>
  );
}

function HighlightCard({ label, yoy, gap }: { label: string; yoy: number | null; gap: number }) {
  const positive = yoy != null && yoy >= 0;
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-border bg-card p-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">YoY e Gap importados</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-2xl font-semibold leading-8 tracking-tight">
          <MetricValue value={yoy == null ? "—" : fmtPct(yoy)} positive={positive} />
        </p>
        <p className="mt-0.5 text-xs tabular-nums text-muted-foreground">Gap {fmtDec(gap)}</p>
      </div>
    </div>
  );
}

/**
 * Valor com direção: a seta indica o sentido e a cor indica o significado comercial,
 * como já era. Indisponível ("—") não recebe seta nem cor de resultado.
 */
function MetricValue({ value, positive }: { value: string; positive: boolean }) {
  const Icon = positive ? TrendingUp : TrendingDown;
  const unavailable = value === "—";
  const color = unavailable
    ? "text-muted-foreground"
    : positive
      ? "text-success"
      : "text-destructive";
  return (
    <span
      className={`inline-flex items-center justify-end gap-1.5 font-semibold tabular-nums ${color}`}
    >
      {!unavailable && <Icon className="size-3.5" aria-hidden="true" />}
      {value}
    </span>
  );
}
