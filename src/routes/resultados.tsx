import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  Award,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  PencilLine,
  TrendingDown,
  TrendingUp,
  Upload,
} from "lucide-react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { usePartnerFilter } from "@/contexts/AppContexts";
import { usePartners } from "@/hooks/useData";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtDec, fmtPct } from "@/lib/format";
import { readXlsxRows } from "@/lib/xlsx-reader";
import type {
  BestGuessRecord,
  BestGuessTotal,
  PortabilidadeSnapshot,
  ResultadosYoySnapshot,
  ServiceTower,
} from "@/lib/snapshot-types";

type PeriodInput = { meta: number; real: number };
type EditableMetric = { previous: PeriodInput; current: PeriodInput };
type PeriodCalculation = { attainment: number | null; gap: number; average: number };
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

  let product = "";
  const records: SourceRecord[] = [];
  for (const row of rows.slice(headerIndex + 1)) {
    const rawProduct = String(row[0] ?? "").trim();
    if (rawProduct) product = rawProduct;
    const company = String(row[2] ?? "").trim();
    const meta = numberFromCell(row[6]);
    const real = numberFromCell(row[7]);
    if (!product || !company || !Number.isFinite(meta) || !Number.isFinite(real)) continue;
    records.push({
      company,
      product: productLabels[normalizeCompany(product)] ?? product,
      meta,
      real,
      previousMeta: Number.isFinite(numberFromCell(row[13])) ? numberFromCell(row[13]) : 0,
      previousReal: Number.isFinite(numberFromCell(row[14])) ? numberFromCell(row[14]) : 0,
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
const calculatePeriod = (input: PeriodInput, monthsElapsed: number): PeriodCalculation => ({
  attainment: input.meta > 0 ? input.real / input.meta : null,
  gap: input.real - input.meta,
  average: input.real / monthsElapsed,
});

export const Route = createFileRoute("/resultados")({
  head: () => ({ meta: [{ title: "Visão resultado — Mapa Parque" }] }),
  component: ResultadosPage,
});

function ResultadosPage() {
  const { selected } = usePartnerFilter();
  const { data: partners = [] } = usePartners();
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
      })
      .catch((error) => {
        if (!active) return;
        setUploadState({
          status: "error",
          message: error instanceof Error ? error.message : "Falha ao carregar os resultados.",
        });
      });
    return () => {
      active = false;
    };
  }, []);

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
        previousMeta: number;
        previousReal: number;
      }
    >();

    for (const record of sourceRows) {
      const current = byProduct.get(record.product) ?? {
        product: record.product,
        meta: 0,
        real: 0,
        previousMeta: 0,
        previousReal: 0,
      };
      current.meta += record.meta;
      current.real += record.real;
      current.previousMeta += record.previousMeta;
      current.previousReal += record.previousReal;
      byProduct.set(record.product, current);
    }

    return [...byProduct.values()];
  }, [partners, selected, sourceRecords]);

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
          previous: calculatePeriod(editable.previous, reportSource?.monthsElapsed ?? 1),
          current: calculatePeriod(editable.current, reportSource?.monthsElapsed ?? 1),
          yoy:
            editable.previous.real > 0 ? editable.current.real / editable.previous.real - 1 : null,
          yoyGap: editable.current.real - editable.previous.real,
        };
      }),
    [inputs, reportSource?.monthsElapsed, scopeKey, scopedRecords],
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

  return (
    <DashboardLayout title="Visão resultado">
      <Card className="relative mb-7 overflow-hidden rounded-[2rem] border-primary/15 bg-gradient-to-br from-primary/[0.16] via-card/95 to-cyan/[0.13] p-5 shadow-elevated backdrop-blur-sm sm:p-6 md:p-8">
        <div className="pointer-events-none absolute -left-12 -top-16 size-60 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 right-0 size-64 rounded-full bg-cyan/25 blur-3xl" />
        <div className="pointer-events-none absolute right-1/3 top-8 size-32 rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative">
          <div className="flex items-start gap-4">
            <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-elegant ring-4 ring-primary/10">
              <BarChart3 className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                Resultado consolidado
              </p>
              <h2 className="mt-2 bg-gradient-brand bg-clip-text text-3xl font-semibold leading-[1.08] tracking-tight text-transparent md:text-4xl">
                Comparativo de resultado 2025 × 2026.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Meta e Real são editáveis; percentual, Gap TT, média e YoY são recalculados
                automaticamente.
              </p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={handleSpreadsheetUpload}
          />
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {highlights.map(({ label, row }) => (
              <HighlightCard key={label} label={label} yoy={row.yoy} gap={row.yoyGap} />
            ))}
          </div>
        </div>
      </Card>

      <div className="space-y-6">
        <ServiceTowersPanel
          towers={completeTowers}
          activeIndex={towerIndex}
          onSelect={setTowerIndex}
          onPrevious={() =>
            setTowerIndex((current) =>
              (current - 1 + completeTowers.length) % completeTowers.length,
            )
          }
          onNext={() => setTowerIndex((current) => (current + 1) % completeTowers.length)}
        />
        <PeriodPanel
          rows={rows}
          title={reportSource?.period ?? "YTD por produto"}
          monthsElapsed={reportSource?.monthsElapsed ?? 1}
          subtitle="Resultado atual"
          tone="current"
          period="current"
          onUpdate={updateValue}
        />
        <PortabilityPanel
          records={scopedBestGuessRecords}
          total={selectedCompanies.size ? undefined : bestGuessTotal}
        />
        <AnalyticalPortabilityPanel
          summary={portabilitySummary}
          onUpload={() => fileInputRef.current?.click()}
          loading={uploadState.status === "loading"}
        />
      </div>
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
    { field: "jan", label: "Jan", width: "w-[90px]", numeric: true },
    { field: "feb", label: "Fev", width: "w-[90px]", numeric: true },
    { field: "mar", label: "Mar", width: "w-[90px]", numeric: true },
    { field: "apr", label: "Abr", width: "w-[90px]", numeric: true },
    { field: "may", label: "Mai", width: "w-[90px]", numeric: true },
    { field: "jun", label: "Jun", width: "w-[90px]", numeric: true },
    { field: "totalizer", label: "Totalizador", width: "w-[130px]", numeric: true },
    { field: "points", label: "Pts", width: "w-[105px]", numeric: true },
    { field: "band", label: "Faixa", width: "w-[130px]" },
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
        <div className="overflow-x-auto rounded-2xl border border-violet-500/15 bg-background/80 shadow-elegant">
          <Table className="min-w-[1600px] table-fixed">
            <colgroup>
              <col className="w-[360px]" />
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
                    <TableCell key={column.field}>
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
        </div>
      </div>
    </Card>
  );
}

function PeriodPanel({
  rows,
  title,
  monthsElapsed,
  subtitle,
  tone,
  period,
  onUpdate,
}: {
  rows: ResultRow[];
  title: string;
  monthsElapsed: number;
  subtitle: string;
  tone: "previous" | "current";
  period: PeriodKey;
  onUpdate: (product: string, period: PeriodKey, field: keyof PeriodInput, value: string) => void;
}) {
  const isCurrent = tone === "current";
  const periodLabel = title.replace("YTD ", "");
  const calculationKey = isCurrent ? "current" : "previous";
  const inputKey = isCurrent ? "currentInput" : "previousInput";
  const headerTint = isCurrent ? "bg-primary/[0.03]" : "bg-violet-500/[0.035]";
  const iconTint = isCurrent
    ? "bg-primary/[0.12] text-primary"
    : "bg-violet-500/[0.12] text-violet-700 dark:text-violet-300";
  const badgeClass = isCurrent ? "border-primary/15" : "border-violet-500/20";
  const totalInput = rows.reduce<PeriodInput>(
    (total, row) => ({
      meta: total.meta + row[inputKey].meta,
      real: total.real + row[inputKey].real,
    }),
    { meta: 0, real: 0 },
  );
  const totalCalculation = calculatePeriod(totalInput, monthsElapsed);
  const totalPrevious = rows.reduce((total, row) => total + row.previousInput.real, 0);
  const totalYoy = totalPrevious > 0 ? totalInput.real / totalPrevious - 1 : null;
  const totalYoyGap = totalInput.real - totalPrevious;

  return (
    <Card className="overflow-hidden rounded-[2rem] border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.035] shadow-elevated">
      <div
        className={`flex flex-col gap-4 border-b border-primary/10 px-5 py-5 md:flex-row md:items-center md:justify-between md:px-7 ${headerTint}`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`grid size-10 place-items-center rounded-2xl shadow-sm ring-4 ring-background/40 ${iconTint}`}
          >
            <PencilLine className="size-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              {subtitle}
            </p>
            <h3 className="text-lg font-semibold tracking-tight">{title} por produto</h3>
          </div>
        </div>
        <span
          className={`w-fit self-start rounded-full border bg-background/75 px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm md:self-auto ${badgeClass}`}
        >
          Meta e Real editáveis
        </span>
      </div>
      <div className="p-3 sm:p-5">
        <div className="overflow-x-auto rounded-2xl border border-primary/12 bg-background/80 shadow-elegant">
          <Table className="min-w-[1240px] table-fixed">
            <colgroup>
              <col className="w-[260px]" />
              <col className="w-[145px]" />
              <col className="w-[145px]" />
              <col className="w-[105px]" />
              <col className="w-[135px]" />
              <col className="w-[135px]" />
              <col className="w-[150px]" />
              <col className="w-[115px]" />
            </colgroup>
            <TableHeader
              className={`[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:h-auto [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-primary/10 [&_th]:px-4 [&_th]:py-3.5 [&_th]:text-[10px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.13em] [&_th]:text-muted-foreground ${headerTint}`}
            >
              <TableRow className="hover:bg-transparent">
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Meta</TableHead>
                <TableHead className="text-right">Real 2026</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="text-right">Gap TT</TableHead>
                <TableHead className="text-right">Média/mês</TableHead>
                <TableHead className="border-l border-cyan/15 bg-cyan/[0.04] text-right text-cyan">
                  YoY R$
                </TableHead>
                <TableHead className="bg-cyan/[0.04] text-right text-cyan">YoY %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="[&_td]:whitespace-nowrap [&_td]:px-4 [&_td]:py-3.5 [&_tr]:border-primary/[0.07] [&_tr]:transition-colors [&_tr:hover]:bg-primary/[0.035]">
              {rows.map((row) => {
                const calculation = row[calculationKey];
                const input = row[inputKey];
                return (
                  <TableRow key={`${period}-${row.id}`}>
                    <TableCell>
                      <p className="font-semibold text-foreground">{row.product}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        Indicadores por YTD
                      </p>
                    </TableCell>
                    <EditableNumberCell
                      ariaLabel={`Meta ${periodLabel} de ${row.product}`}
                      value={input.meta}
                      tone={tone}
                      onChange={(value) => onUpdate(row.id, period, "meta", value)}
                    />
                    <EditableNumberCell
                      ariaLabel={`Real ${periodLabel} de ${row.product}`}
                      value={input.real}
                      tone={tone}
                      onChange={(value) => onUpdate(row.id, period, "real", value)}
                    />
                    <TableCell className="text-right">
                      <MetricValue
                        value={
                          calculation.attainment == null ? "—" : fmtPct(calculation.attainment)
                        }
                        positive={calculation.attainment != null && calculation.attainment >= 1}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <MetricValue
                        value={fmtDec(calculation.gap)}
                        positive={calculation.gap >= 0}
                      />
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums text-foreground">
                      {fmtDec(calculation.average)}
                    </TableCell>
                    <TableCell className="border-l border-cyan/15 bg-cyan/[0.025] text-right">
                      <MetricValue value={fmtDec(row.yoyGap)} positive={row.yoyGap >= 0} />
                    </TableCell>
                    <TableCell className="bg-cyan/[0.025] text-right">
                      <MetricValue
                        value={row.yoy == null ? "—" : fmtPct(row.yoy)}
                        positive={row.yoy != null && row.yoy >= 0}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className={`border-t-2 border-primary/15 ${headerTint}`}>
                <TableCell className="font-semibold text-foreground">Total</TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-foreground">
                  {fmtDec(totalInput.meta)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-foreground">
                  {fmtDec(totalInput.real)}
                </TableCell>
                <TableCell className="text-right">
                  <MetricValue
                    value={
                      totalCalculation.attainment == null
                        ? "—"
                        : fmtPct(totalCalculation.attainment)
                    }
                    positive={
                      totalCalculation.attainment != null && totalCalculation.attainment >= 1
                    }
                  />
                </TableCell>
                <TableCell className="text-right">
                  <MetricValue
                    value={fmtDec(totalCalculation.gap)}
                    positive={totalCalculation.gap >= 0}
                  />
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-foreground">
                  {fmtDec(totalCalculation.average)}
                </TableCell>
                <TableCell className="border-l border-cyan/15 bg-cyan/[0.025] text-right">
                  <MetricValue value={fmtDec(totalYoyGap)} positive={totalYoyGap >= 0} />
                </TableCell>
                <TableCell className="bg-cyan/[0.025] text-right">
                  <MetricValue
                    value={totalYoy == null ? "—" : fmtPct(totalYoy)}
                    positive={totalYoy != null && totalYoy >= 0}
                  />
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </Card>
  );
}

function PortabilityPanel({
  records,
  total: sourceTotal,
}: {
  records: BestGuessRecord[];
  total?: BestGuessTotal;
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
  const valueCell = (value: number) => (
    <TableCell
      className={`text-right font-semibold tabular-nums ${value < 0 ? "text-rose-600 dark:text-rose-400" : "text-foreground"}`}
    >
      {fmtDec(value)}
    </TableCell>
  );

  return (
    <Card className="overflow-hidden rounded-[2rem] border-cyan/20 bg-gradient-to-br from-card via-card to-cyan/[0.045] shadow-elevated">
      <div className="flex flex-col gap-3 border-b border-cyan/15 bg-cyan/[0.035] px-5 py-5 md:flex-row md:items-center md:justify-between md:px-7">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-2xl bg-cyan/[0.13] text-cyan shadow-sm ring-4 ring-background/40">
            <BarChart3 className="size-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan">
              Portabilidade móvel
            </p>
            <h3 className="text-lg font-semibold tracking-tight">M0 MTD × BG FM por parceiro</h3>
          </div>
        </div>
        <span className="w-fit self-start rounded-full border border-cyan/15 bg-background/75 px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm md:self-auto">
          Base Best Guess
        </span>
      </div>
      <div className="p-3 sm:p-5">
        <div className="overflow-x-auto rounded-2xl border border-cyan/15 bg-background/80 shadow-elegant">
          <Table className="min-w-[1040px] table-fixed">
            <colgroup>
              <col className="w-[230px]" />
              <col className="w-[145px]" />
              <col className="w-[145px]" />
              <col className="w-[145px]" />
              <col className="w-[145px]" />
              <col className="w-[145px]" />
              <col className="w-[145px]" />
            </colgroup>
            <TableHeader className="bg-cyan/[0.045] [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:h-auto [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-cyan/15 [&_th]:px-4 [&_th]:py-3.5 [&_th]:text-[10px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.1em] [&_th]:text-muted-foreground">
              <TableRow className="hover:bg-transparent">
                <TableHead>Parceiro</TableHead>
                <TableHead className="text-right">M0 MTD Port-In</TableHead>
                <TableHead className="text-right">M0 MTD Port-Out</TableHead>
                <TableHead className="text-right">M0 MTD Saldo</TableHead>
                <TableHead className="border-l border-cyan/15 bg-cyan/[0.025] text-right text-cyan">
                  BG FM Port-In
                </TableHead>
                <TableHead className="bg-cyan/[0.025] text-right text-cyan">
                  BG FM Port-Out
                </TableHead>
                <TableHead className="bg-cyan/[0.025] text-right text-cyan">BG FM Saldo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="[&_td]:whitespace-nowrap [&_td]:px-4 [&_td]:py-3.5 [&_tr]:border-cyan/[0.1] [&_tr]:transition-colors [&_tr:hover]:bg-cyan/[0.035]">
              {records.map((record) => (
                <TableRow key={record.company}>
                  <TableCell className="font-semibold text-foreground">{record.company}</TableCell>
                  {valueCell(record.m0MtdPortIn)}
                  {valueCell(record.m0MtdPortOut)}
                  {valueCell(record.m0MtdSaldo)}
                  {valueCell(record.bgFmPortIn)}
                  {valueCell(record.bgFmPortOut)}
                  {valueCell(record.bgFmSaldo)}
                </TableRow>
              ))}
              <TableRow className="border-t-2 border-cyan/20 bg-cyan/[0.04]">
                <TableCell className="font-semibold text-foreground">Total</TableCell>
                {valueCell(total.m0MtdPortIn)}
                {valueCell(total.m0MtdPortOut)}
                {valueCell(total.m0MtdSaldo)}
                {valueCell(total.bgFmPortIn)}
                {valueCell(total.bgFmPortOut)}
                {valueCell(total.bgFmSaldo)}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </Card>
  );
}

function AnalyticalPortabilityPanel({
  summary,
  onUpload,
  loading,
}: {
  summary: { rows: PortabilitySummaryRow[]; total: PortabilitySummaryTotal };
  onUpload: () => void;
  loading: boolean;
}) {
  const { rows, total } = summary;
  const periodLabel = rows.length
    ? `${rows[0].label} a ${rows[rows.length - 1].label}`
    : "Sem período disponível";
  const indicator = (
    label: string,
    value: number | null,
    tone: "neutral" | "positive" | "negative",
    format: "integer" | "percent" = "integer",
  ) => {
    const toneClass =
      tone === "positive"
        ? "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-700 dark:text-emerald-300"
        : tone === "negative"
          ? "border-rose-500/20 bg-rose-500/[0.055] text-rose-700 dark:text-rose-300"
          : "border-cyan/15 bg-background/55 text-foreground";
    const displayValue =
      value == null ? "—" : format === "percent" ? fmtPct(value) : formatInteger(value);
    return (
      <div className={`rounded-2xl border p-4 ${toneClass}`}>
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{displayValue}</p>
      </div>
    );
  };
  const leaderCell = (operator: string) => (
    <TableCell className="text-right font-semibold text-foreground">{operator}</TableCell>
  );
  const saldoCell = (value: number) => (
    <TableCell className="text-right">
      <MetricValue value={formatInteger(value)} positive={value >= 0} />
    </TableCell>
  );
  const conversionCell = (value: number | null) => (
    <TableCell className="bg-emerald-500/[0.025] text-right">
      <MetricValue
        value={value == null ? "—" : fmtPct(value)}
        positive={value != null && value >= 0}
      />
    </TableCell>
  );

  return (
    <Card className="overflow-hidden rounded-[2rem] border-emerald-500/15 bg-gradient-to-br from-card via-card to-emerald-500/[0.035] shadow-elevated">
      <div className="flex flex-col gap-3 border-b border-emerald-500/15 bg-emerald-500/[0.035] px-5 py-5 md:flex-row md:items-center md:justify-between md:px-7">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-2xl bg-emerald-500/[0.13] text-emerald-600 shadow-sm ring-4 ring-background/40 dark:text-emerald-300">
            <TrendingUp className="size-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              Resumo analítico
            </p>
            <h3 className="text-lg font-semibold tracking-tight">Evolução de portabilidade</h3>
          </div>
        </div>
        <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
          <span className="rounded-full border border-emerald-500/15 bg-background/75 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
            Últimos {rows.length} meses · {periodLabel}
          </span>
          <Button
            type="button"
            variant="outline"
            onClick={onUpload}
            disabled={loading}
            className="h-9 rounded-xl border-emerald-500/20 bg-background/75 px-3 text-xs"
          >
            <Upload className="size-3.5" />
            {loading ? "Atualizando..." : "Atualizar planilha"}
          </Button>
        </div>
      </div>
      <div className="space-y-5 p-3 sm:p-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {indicator("PortIn acumulado", total.portIn, "positive")}
          {indicator("PortOut acumulado", total.portOut, "neutral")}
          {indicator(
            "Saldo líquido acumulado",
            total.saldo,
            total.saldo >= 0 ? "positive" : "negative",
          )}
          {indicator(
            "Conversão de portabilidade",
            total.conversion,
            total.conversion != null && total.conversion >= 0 ? "positive" : "negative",
            "percent",
          )}
        </div>
        <div className="overflow-x-auto rounded-2xl border border-emerald-500/15 bg-background/80 shadow-elegant">
          <Table className="min-w-[1470px] table-fixed">
            <colgroup>
              <col className="w-[170px]" />
              <col className="w-[135px]" />
              <col className="w-[135px]" />
              <col className="w-[135px]" />
              <col className="w-[145px]" />
              <col className="w-[210px]" />
              <col className="w-[170px]" />
              <col className="w-[210px]" />
              <col className="w-[170px]" />
            </colgroup>
            <TableHeader className="bg-emerald-500/[0.045] [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:h-auto [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-emerald-500/15 [&_th]:px-4 [&_th]:py-3.5 [&_th]:text-[10px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.09em] [&_th]:text-muted-foreground">
              <TableRow className="hover:bg-transparent">
                <TableHead>Mês</TableHead>
                <TableHead className="text-right">PortIn total</TableHead>
                <TableHead className="text-right">PortOut total</TableHead>
                <TableHead className="text-right">Saldo líquido</TableHead>
                <TableHead className="bg-emerald-500/[0.025] text-right text-emerald-700 dark:text-emerald-300">
                  Conversão
                </TableHead>
                <TableHead className="text-right">Operadora líder em PortIn</TableHead>
                <TableHead className="text-right">Volume de PortIn</TableHead>
                <TableHead className="text-right">Operadora líder em PortOut</TableHead>
                <TableHead className="text-right">Volume de PortOut</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="[&_td]:whitespace-nowrap [&_td]:px-4 [&_td]:py-3.5 [&_tr]:border-emerald-500/[0.1] [&_tr]:transition-colors [&_tr:hover]:bg-emerald-500/[0.035]">
              {rows.map((row) => (
                <TableRow key={row.month}>
                  <TableCell className="font-semibold text-foreground">{row.label}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-foreground">
                    {formatInteger(row.portIn)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-foreground">
                    {formatInteger(row.portOut)}
                  </TableCell>
                  {saldoCell(row.saldo)}
                  {conversionCell(row.conversion)}
                  {leaderCell(row.leaderPortIn)}
                  <TableCell className="text-right font-semibold tabular-nums text-foreground">
                    {formatInteger(row.leaderPortInVolume)}
                  </TableCell>
                  {leaderCell(row.leaderPortOut)}
                  <TableCell className="text-right font-semibold tabular-nums text-foreground">
                    {formatInteger(row.leaderPortOutVolume)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="border-t-2 border-emerald-500/20 bg-emerald-500/[0.04]">
                <TableCell className="font-semibold text-foreground">Total acumulado</TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-foreground">
                  {formatInteger(total.portIn)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums text-foreground">
                  {formatInteger(total.portOut)}
                </TableCell>
                {saldoCell(total.saldo)}
                {conversionCell(total.conversion)}
                {leaderCell(total.leaderPortIn)}
                <TableCell className="text-right font-semibold tabular-nums text-foreground">
                  {formatInteger(total.leaderPortInVolume)}
                </TableCell>
                {leaderCell(total.leaderPortOut)}
                <TableCell className="text-right font-semibold tabular-nums text-foreground">
                  {formatInteger(total.leaderPortOutVolume)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </Card>
  );
}

function ServiceTowersPanel({
  towers,
  activeIndex,
  onSelect,
  onPrevious,
  onNext,
}: {
  towers: ServiceTower[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const tower = towers[activeIndex] ?? towers[0];
  if (!tower) return null;
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
    if (value <= 0.5) return "font-semibold text-rose-600 dark:text-rose-400";
    if (value < 0.8) return "font-semibold text-amber-600 dark:text-amber-400";
    if (value > 0.9) return "font-semibold text-emerald-600 dark:text-emerald-400";
    return "text-foreground";
  };

  return (
    <Card className="overflow-hidden rounded-[2rem] border-violet-500/20 bg-gradient-to-br from-card via-card to-violet-500/[0.05] shadow-elevated">
      <div className="flex flex-col gap-4 border-b border-violet-500/15 bg-violet-500/[0.04] px-5 py-5 sm:px-6 md:flex-row md:items-center md:justify-between md:px-7">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-2xl bg-violet-500/[0.13] text-violet-700 shadow-sm ring-4 ring-background/40 dark:text-violet-300">
            <BarChart3 className="size-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-violet-700 dark:text-violet-300">
              Acompanhamento comercial
            </p>
            <h3 className="text-lg font-semibold tracking-tight">Torres de serviço</h3>
          </div>
        </div>
        <div className="flex items-center gap-2 self-end md:self-auto">
          <span className="mr-1 text-xs font-medium tabular-nums text-muted-foreground">
            {activeIndex + 1} / {towers.length}
          </span>
          <Button type="button" variant="outline" size="icon" onClick={onPrevious} className="size-9 rounded-xl border-violet-500/20 bg-background/70">
            <ChevronLeft className="size-4" />
            <span className="sr-only">Torre anterior</span>
          </Button>
          <Button type="button" variant="outline" size="icon" onClick={onNext} className="size-9 rounded-xl border-violet-500/20 bg-background/70">
            <ChevronRight className="size-4" />
            <span className="sr-only">Próxima torre</span>
          </Button>
        </div>
      </div>
      <div className="p-3 sm:p-5">
        <div className="mb-4 flex flex-wrap gap-2" aria-label="Seleção de torre de serviço">
          {towers.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(index)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${index === activeIndex ? "border-violet-500/35 bg-violet-500/15 text-violet-800 dark:text-violet-200" : "border-border bg-background/65 text-muted-foreground hover:border-violet-500/25 hover:text-foreground"}`}
            >
              {item.title}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto rounded-2xl border border-violet-500/15 bg-background/80 shadow-elegant">
          <Table className="min-w-max table-fixed">
            <TableHeader className="bg-violet-500/[0.05] [&_th]:h-auto [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-violet-500/15 [&_th]:px-4 [&_th]:py-3.5 [&_th]:text-[10px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.1em] [&_th]:text-muted-foreground">
              <TableRow className="hover:bg-transparent">
                <TableHead className="sticky left-0 z-10 min-w-[190px] bg-violet-500/[0.05]">NM_REDE</TableHead>
                {visibleColumns.map((column) => (
                  <TableHead key={column.key} className="min-w-[116px] text-right">{column.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody className="[&_td]:whitespace-nowrap [&_td]:px-4 [&_td]:py-3.5 [&_tr]:border-violet-500/[0.09] [&_tr]:transition-colors [&_tr:hover]:bg-violet-500/[0.035]">
              {tower.rows.map((row) => (
                <TableRow key={`${tower.id}-${row.partner}`}>
                  <TableCell className="sticky left-0 z-[1] bg-background font-semibold text-foreground group-hover:bg-violet-500/[0.035]">
                    {row.partner}
                  </TableCell>
                  {visibleColumns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={`text-right font-medium tabular-nums ${performanceClass(row.values[column.key], column.format)}`}
                    >
                      {showValue(row.values[column.key], column.format)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
              <TableRow className="border-t-2 border-violet-500/20 bg-violet-500/[0.05]">
                <TableCell className="sticky left-0 z-[1] bg-violet-500/[0.05] font-semibold text-foreground">TT</TableCell>
                {visibleColumns.map((column) => (
                  <TableCell
                    key={column.key}
                    className={`text-right font-semibold tabular-nums ${performanceClass(tower.total[column.key], column.format)}`}
                  >
                    {showValue(tower.total[column.key], column.format)}
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </Card>
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

function EditableNumberCell({
  ariaLabel,
  value,
  tone,
  onChange,
}: {
  ariaLabel: string;
  value: number;
  tone: "previous" | "current";
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState(() => formatInputNumber(value));
  const [focused, setFocused] = useState(false);
  const toneClass =
    tone === "previous"
      ? "border-violet-500/20 bg-violet-500/[0.055] focus-visible:border-violet-500/50 focus-visible:ring-violet-500/15"
      : "border-primary/25 bg-primary/[0.055] focus-visible:border-primary/50 focus-visible:ring-primary/15";

  useEffect(() => {
    if (!focused) setDraft(formatInputNumber(value));
  }, [focused, value]);

  return (
    <TableCell>
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
        className={`h-10 w-full rounded-xl px-2.5 text-right text-sm font-semibold tabular-nums shadow-sm ${toneClass}`}
      />
    </TableCell>
  );
}

function HighlightCard({ label, yoy, gap }: { label: string; yoy: number | null; gap: number }) {
  const positive = yoy != null && yoy >= 0;
  const toneClass = positive
    ? "border-emerald-500/20 bg-emerald-500/[0.06]"
    : "border-rose-500/20 bg-rose-500/[0.055]";
  const iconClass = positive
    ? "bg-emerald-500/[0.13] text-emerald-600 dark:text-emerald-400"
    : "bg-rose-500/[0.13] text-rose-600 dark:text-rose-400";
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <div
      className={`flex items-center justify-between gap-4 rounded-2xl border p-4 shadow-sm backdrop-blur-sm transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-elegant ${toneClass}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`grid size-9 shrink-0 place-items-center rounded-xl shadow-sm ${iconClass}`}
        >
          <Icon className="size-4" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{label}</p>
          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">Crescimento YoY</p>
        </div>
      </div>
      <div className="text-right">
        <MetricValue value={yoy == null ? "—" : fmtPct(yoy)} positive={positive} />
        <p className="mt-1 text-[11px] font-medium tabular-nums text-muted-foreground">
          Gap {fmtDec(gap)}
        </p>
      </div>
    </div>
  );
}

function MetricValue({ value, positive }: { value: string; positive: boolean }) {
  const Icon = positive ? TrendingUp : TrendingDown;
  const color = positive
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-rose-600 dark:text-rose-400";
  return (
    <span
      className={`inline-flex items-center justify-end gap-1.5 font-semibold tabular-nums ${color}`}
    >
      {value !== "—" && <Icon className="size-3.5" />}
      {value}
    </span>
  );
}
