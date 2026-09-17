import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, BarChart3, Gauge, Printer, ShieldCheck, Smartphone, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePartnerFilter } from "@/contexts/AppContexts";
import { useFtth, useMobile, usePartners, useQsc } from "@/hooks/useData";
import { fmtBRLCompact, fmtDec, fmtInt, fmtPct } from "@/lib/format";
import type { QscDomain, QscMetricSeries } from "@/lib/qsc";
import type {
  BestGuessRecord,
  BestGuessTotal,
  PortabilidadeSnapshot,
  ResultadosYoySnapshot,
  ServiceTower,
} from "@/lib/snapshot-types";

type SourceRecord = ResultadosYoySnapshot["records"][number];
type AnalyticalRecord = PortabilidadeSnapshot["records"][number];
type RuntimeResults = {
  resultados: { source: ResultadosYoySnapshot["source"]; records: SourceRecord[] };
  bestGuess: { records: BestGuessRecord[]; total: BestGuessTotal };
  portabilidade: { records: AnalyticalRecord[] };
  torres: { towers: ServiceTower[] };
};

type YtdSummary = {
  product: string;
  meta: number;
  real: number;
  previousReal: number;
  attainment: number | null;
  gap: number;
  average: number;
  yoyGap: number;
  yoy: number | null;
};

const EMPTY_BEST_GUESS: BestGuessTotal = {
  m0MtdPortIn: 0,
  m0MtdPortOut: 0,
  m0MtdSaldo: 0,
  bgFmPortIn: 0,
  bgFmPortOut: 0,
  bgFmSaldo: 0,
};

const TOWER_PRODUCT_MAP: Record<string, string> = {
  "altas-movel": "Móvel Líquido",
  aparelhos: "Aparelhos",
  "banda-larga": "Banda Larga",
  "dados-avancados": "Dados Avançados",
  vvn: "VVN",
  voz: "Voz Avançada",
  "ti-recorrente": "TI Recorrente",
  "vivo-tech": "Vivo Tech",
};

const PULSE_METRICS = [
  { id: "early-churn-fixa", label: "Early Churn Fixa" },
  { id: "early-churn-movel", label: "Early Churn Móvel" },
  { id: "churn-bl", label: "Churn Fixa" },
  { id: "churn-movel", label: "Churn Móvel" },
  { id: "saldo-portabilidade", label: "Saldo de Portabilidade" },
] as const;

const DOMAIN_LABELS: Array<{ domain: QscDomain; label: string }> = [
  { domain: "carteira", label: "QSC Carteira" },
  { domain: "fixa", label: "QSC Fixa" },
  { domain: "movel", label: "QSC Móvel" },
];

export const Route = createFileRoute("/relatorio-executivo")({
  validateSearch: (search: Record<string, unknown>) => ({
    tower: typeof search.tower === "string" ? search.tower : undefined,
  }),
  head: () => ({ meta: [{ title: "Relatório executivo — Mapa Parque" }] }),
  component: ExecutiveReportPage,
});

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function sumBestGuess(records: BestGuessRecord[]): BestGuessTotal {
  return records.reduce<BestGuessTotal>(
    (total, record) => ({
      m0MtdPortIn: total.m0MtdPortIn + record.m0MtdPortIn,
      m0MtdPortOut: total.m0MtdPortOut + record.m0MtdPortOut,
      m0MtdSaldo: total.m0MtdSaldo + record.m0MtdSaldo,
      bgFmPortIn: total.bgFmPortIn + record.bgFmPortIn,
      bgFmPortOut: total.bgFmPortOut + record.bgFmPortOut,
      bgFmSaldo: total.bgFmSaldo + record.bgFmSaldo,
    }),
    { ...EMPTY_BEST_GUESS },
  );
}

function monthLabel(month: number) {
  return new Intl.DateTimeFormat("pt-BR", { month: "short" })
    .format(new Date(2026, month - 1, 1))
    .replace(".", "");
}

function competenceLabel(competence?: string) {
  if (!competence) return "Sem competência";
  const [year, month] = competence.split("-").map(Number);
  if (!year || !month) return competence;
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(
    new Date(year, month - 1, 1),
  );
}

function semesterCompetencies(competence: string) {
  const year = Number(competence.slice(0, 4)) || new Date().getFullYear();
  const month = Number(competence.slice(5, 7)) || new Date().getMonth() + 1;
  const firstMonth = month <= 6 ? 1 : 7;
  return Array.from(
    { length: 6 },
    (_, index) => `${year}-${String(firstMonth + index).padStart(2, "0")}`,
  );
}

function qscRating(total: number | null) {
  if (total == null) return { band: "—", points: null };
  if (total >= 90) return { band: "Faixa 5", points: 1000 };
  if (total >= 80) return { band: "Faixa 4", points: 800 };
  if (total >= 70) return { band: "Faixa 3", points: 600 };
  if (total >= 60) return { band: "Faixa 2", points: 400 };
  if (total >= 50) return { band: "Faixa 1", points: 200 };
  return { band: "Sem faixa", points: 0 };
}

function qscDomainHistory(domain: QscDomain, metrics: QscMetricSeries[], competencies: string[]) {
  const domainMetrics = metrics.filter((metric) => metric.domain === domain);
  const values = competencies.map((competence) => {
    const scores = domainMetrics.flatMap((metric) => {
      const score = metric.history.find((point) => point.competence === competence)?.score;
      return score == null ? [] : [score];
    });
    return scores.length ? scores.reduce((total, score) => total + score, 0) : null;
  });
  const available = values.filter((value): value is number => value != null);
  const totalizer = available.length
    ? Math.round(available.reduce((total, value) => total + value, 0) / available.length)
    : null;
  return { values, totalizer, ...qscRating(totalizer) };
}

function buildYtdSummary(
  tower: ServiceTower,
  records: SourceRecord[],
  monthsElapsed: number,
): YtdSummary {
  const product = TOWER_PRODUCT_MAP[tower.id] ?? tower.title;
  const matching = records.filter((record) => normalize(record.product) === normalize(product));
  const aggregated = matching.reduce(
    (total, record) => ({
      meta: total.meta + record.meta,
      real: total.real + record.real,
      previousReal: total.previousReal + record.previousReal,
    }),
    { meta: 0, real: 0, previousReal: 0 },
  );
  const months = Math.max(1, monthsElapsed);
  return {
    product,
    ...aggregated,
    attainment: aggregated.meta ? aggregated.real / aggregated.meta : null,
    gap: aggregated.real - aggregated.meta,
    average: aggregated.real / months,
    yoyGap: aggregated.real - aggregated.previousReal,
    yoy: aggregated.previousReal ? aggregated.real / aggregated.previousReal - 1 : null,
  };
}

function ExecutiveReportPage() {
  const { effectiveSelected } = usePartnerFilter();
  const { data: partners = [] } = usePartners();
  const { data: mobile, isLoading: mobileLoading } = useMobile();
  const { data: ftth, isLoading: ftthLoading } = useFtth();
  const { data: qsc, isLoading: qscLoading } = useQsc();
  const [results, setResults] = useState<RuntimeResults | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    void fetch("/api/data/resultados", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Não foi possível carregar os dados do relatório.");
        return response.json() as Promise<RuntimeResults>;
      })
      .then((payload) => {
        if (active) setResults(payload);
      })
      .catch((error) => {
        if (active) {
          setLoadError(error instanceof Error ? error.message : "Falha ao carregar o relatório.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const selectedNames = useMemo(
    () => effectiveSelected.map((id) => partners.find((partner) => partner.id === id)?.name ?? id),
    [effectiveSelected, partners],
  );
  const selectedCompanies = useMemo(() => new Set(selectedNames.map(normalize)), [selectedNames]);
  const partnerLabel = selectedNames.length
    ? selectedNames.length === 1
      ? selectedNames[0]
      : `${selectedNames.length} parceiros selecionados`
    : "Todos os parceiros";

  const towers = results?.torres.towers ?? [];

  const scopedSourceRecords = useMemo(() => {
    const records = results?.resultados.records ?? [];
    return selectedCompanies.size
      ? records.filter((record) => selectedCompanies.has(normalize(record.company)))
      : records;
  }, [results, selectedCompanies]);

  const bestGuessRecords = useMemo(() => {
    const records = results?.bestGuess.records ?? [];
    return selectedCompanies.size
      ? records.filter((record) => selectedCompanies.has(normalize(record.company)))
      : records;
  }, [results, selectedCompanies]);
  const bestGuessTotal = useMemo(
    () =>
      selectedCompanies.size
        ? sumBestGuess(bestGuessRecords)
        : (results?.bestGuess.total ?? EMPTY_BEST_GUESS),
    [bestGuessRecords, results, selectedCompanies.size],
  );

  const portabilityMonths = useMemo(() => {
    const records = results?.portabilidade.records ?? [];
    const scoped = selectedCompanies.size
      ? records.filter((record) => selectedCompanies.has(normalize(record.company)))
      : records;
    const grouped = new Map<number, { portIn: number; portOut: number }>();
    for (const record of scoped) {
      const current = grouped.get(record.month) ?? { portIn: 0, portOut: 0 };
      current.portIn += record.portIn;
      current.portOut += record.portOut;
      grouped.set(record.month, current);
    }
    return [...grouped.entries()]
      .sort(([left], [right]) => left - right)
      .slice(-6)
      .map(([month, values]) => ({
        month,
        ...values,
        saldo: values.portIn - values.portOut,
        conversion: values.portIn ? (values.portIn - values.portOut) / values.portIn : null,
      }));
  }, [results, selectedCompanies]);

  const portabilityTotal = portabilityMonths.reduce(
    (total, month) => ({
      portIn: total.portIn + month.portIn,
      portOut: total.portOut + month.portOut,
      saldo: total.saldo + month.saldo,
    }),
    { portIn: 0, portOut: 0, saldo: 0 },
  );
  const portabilityConversion = portabilityTotal.portIn
    ? portabilityTotal.saldo / portabilityTotal.portIn
    : null;

  const reportDate = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());
  const isLoading = !results || mobileLoading || ftthLoading || qscLoading;
  const totalPages = towers.length + 9;

  if (loadError) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 p-6">
        <div className="max-w-lg rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-xl">
          <h1 className="text-xl font-semibold text-slate-950">Relatório indisponível</h1>
          <p className="mt-2 text-sm text-slate-600">{loadError}</p>
          <Button asChild className="mt-6 rounded-xl">
            <Link to="/resultados">Voltar aos resultados</Link>
          </Button>
        </div>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-100 p-6">
        <div className="text-center">
          <div className="mx-auto size-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-700" />
          <p className="mt-4 text-sm font-medium text-slate-600">Preparando o resumo executivo…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="executive-report min-h-screen bg-slate-100 px-4 py-6 text-slate-950 sm:px-6">
      <div className="no-print sticky top-3 z-50 mx-auto mb-5 flex max-w-[1120px] items-center justify-between gap-3 rounded-2xl border border-white/80 bg-white/90 p-3 shadow-xl backdrop-blur">
        <Button asChild variant="outline" className="rounded-xl">
          <Link to="/resultados">
            <ArrowLeft className="size-4" />
            Voltar
          </Link>
        </Button>
        <div className="hidden text-center sm:block">
          <p className="text-xs font-semibold text-slate-900">
            Relatório executivo · {partnerLabel}
          </p>
          <p className="text-[11px] text-slate-500">A4 horizontal · {totalPages} páginas</p>
        </div>
        <Button
          onClick={() => window.print()}
          className="rounded-xl bg-violet-700 hover:bg-violet-800"
        >
          <Printer className="size-4" />
          Gerar PDF
        </Button>
      </div>

      <CoverReportPage
        partner={partnerLabel}
        date={reportDate}
        towerCount={towers.length}
        totalPages={totalPages}
      />

      <ChapterCoverPage
        id="capitulo-producao"
        page={2}
        totalPages={totalPages}
        number="01"
        eyebrow="Resultado comercial"
        title="Produção e torres de serviço"
        description={`Visão integrada do desempenho YTD e YoY com o acompanhamento das ${towers.length} torres de serviço.`}
        partner={partnerLabel}
        date={reportDate}
        tone="violet"
      />

      {towers.map((tower, index) => (
        <TowerReportPage
          key={tower.id}
          tower={tower}
          page={index + 3}
          totalPages={totalPages}
          partner={partnerLabel}
          date={reportDate}
          selectedCompanies={selectedCompanies}
          records={scopedSourceRecords}
          monthsElapsed={results.resultados.source.monthsElapsed}
          period={results.resultados.source.period}
        />
      ))}

      <ChapterCoverPage
        id="capitulo-portabilidade"
        page={towers.length + 3}
        totalPages={totalPages}
        number="02"
        eyebrow="Produção e tendência"
        title="Portabilidade móvel"
        description="Leitura do movimento de entrada e saída, saldo líquido, conversão e evolução recente do parceiro."
        partner={partnerLabel}
        date={reportDate}
        tone="sky"
      />

      <ReportPage
        page={towers.length + 4}
        totalPages={totalPages}
        title="Portabilidade móvel"
        eyebrow="Produção e tendência"
        partner={partnerLabel}
        date={reportDate}
      >
        <section className="rounded-[1.4rem] border border-sky-100 bg-white p-5 shadow-sm">
          <SectionTitle
            icon={<Smartphone className="size-4" />}
            eyebrow="Portabilidade móvel"
            title="M0 MTD × BG FM por parceiro"
          />
          <CompactTable
            headers={[
              "Parceiro",
              "M0 Port-in",
              "M0 Port-out",
              "M0 Saldo",
              "BG Port-in",
              "BG Port-out",
              "BG Saldo",
            ]}
            rows={bestGuessRecords.map((record) => [
              record.company,
              fmtDec(record.m0MtdPortIn),
              signed(record.m0MtdPortOut),
              signed(record.m0MtdSaldo),
              fmtDec(record.bgFmPortIn),
              signed(record.bgFmPortOut),
              signed(record.bgFmSaldo),
            ])}
            total={[
              "Total",
              fmtDec(bestGuessTotal.m0MtdPortIn),
              signed(bestGuessTotal.m0MtdPortOut),
              signed(bestGuessTotal.m0MtdSaldo),
              fmtDec(bestGuessTotal.bgFmPortIn),
              signed(bestGuessTotal.bgFmPortOut),
              signed(bestGuessTotal.bgFmSaldo),
            ]}
          />
        </section>

        <section className="mt-4 rounded-[1.4rem] border border-emerald-100 bg-white p-5 shadow-sm">
          <SectionTitle
            icon={<Gauge className="size-4" />}
            eyebrow="Resumo analítico"
            title="Evolução de portabilidade"
          />
          <div className="mt-4 grid grid-cols-4 gap-3">
            <MetricCard label="Port-in acumulado" value={fmtInt(portabilityTotal.portIn)} />
            <MetricCard label="Port-out acumulado" value={fmtInt(portabilityTotal.portOut)} />
            <MetricCard
              label="Saldo líquido"
              value={signed(portabilityTotal.saldo)}
              accent="emerald"
            />
            <MetricCard label="Conversão" value={fmtPct(portabilityConversion)} accent="emerald" />
          </div>
          <CompactTable
            headers={["Mês", "Port-in", "Port-out", "Saldo líquido", "Conversão"]}
            rows={portabilityMonths.map((month) => [
              monthLabel(month.month),
              fmtInt(month.portIn),
              fmtInt(month.portOut),
              signed(month.saldo),
              fmtPct(month.conversion),
            ])}
            total={[
              "Total acumulado",
              fmtInt(portabilityTotal.portIn),
              fmtInt(portabilityTotal.portOut),
              signed(portabilityTotal.saldo),
              fmtPct(portabilityConversion),
            ]}
          />
        </section>
      </ReportPage>

      <ChapterCoverPage
        id="capitulo-oportunidades"
        page={towers.length + 5}
        totalPages={totalPages}
        number="03"
        eyebrow="Potencial comercial"
        title="Oportunidades"
        description="Oportunidades móveis, aparelhos, renovação e cobertura FTTH reunidas para orientar a atuação comercial."
        partner={partnerLabel}
        date={reportDate}
        tone="fuchsia"
      />

      <ReportPage
        page={towers.length + 6}
        totalPages={totalPages}
        title="Oportunidades móveis em foco"
        eyebrow="Portfólio móvel"
        partner={partnerLabel}
        date={reportDate}
      >
        <div className="grid grid-cols-3 gap-4">
          <HeroMetric label="Oportunidade móvel" value={fmtInt(mobile?.kpis.baseRecMovel)} />
          <HeroMetric
            label="Aquisição móvel"
            value={fmtInt(mobile?.kpis.aquisicaoMovel)}
            tone="sky"
          />
          <HeroMetric
            label="Renovação FTTH + totalização"
            value={fmtInt(mobile?.kpis.renovacaoFtthTotalizacao)}
            tone="violet"
          />
        </div>
        <section className="mt-5">
          <SectionTitle
            icon={<Smartphone className="size-4" />}
            eyebrow="Pré-aprovação de crédito"
            title="Oportunidades de aparelhos"
          />
          <div className="mt-3 grid grid-cols-4 gap-3">
            <MetricCard
              label="Oportunidades"
              value={fmtInt(mobile?.kpis.oportunidadesAparelhos)}
              accent="violet"
            />
            <MetricCard label="iPhone" value={fmtInt(mobile?.kpis.aparelhosIphone)} />
            <MetricCard label="Galaxy S/Fold" value={fmtInt(mobile?.kpis.aparelhosGalaxyPremium)} />
            <MetricCard label="Outros aparelhos" value={fmtInt(mobile?.kpis.aparelhosOutros)} />
          </div>
        </section>
        <div className="mt-5 grid grid-cols-3 gap-4">
          <LargeSummary
            label="Crédito de aparelho"
            value={fmtBRLCompact(mobile?.kpis.creditoAparelhos)}
          />
          <LargeSummary
            label="Renovação móvel + aparelho"
            value={fmtInt(mobile?.kpis.renovacaoMovelComAparelho)}
            tone="violet"
          />
          <LargeSummary
            label="Aparelho sem renovação"
            value={fmtInt(mobile?.kpis.aparelhoSemRenovacao)}
            tone="sky"
          />
        </div>
      </ReportPage>

      <ReportPage
        page={towers.length + 7}
        totalPages={totalPages}
        title="Cobertura e renovação em foco"
        eyebrow="Conectividade FTTH"
        partner={partnerLabel}
        date={reportDate}
      >
        <div className="grid grid-cols-2 gap-4">
          <HeroMetric label="Aquisição fixa básica" value={fmtInt(ftth?.kpis.oportunidades)} />
          <HeroMetric
            label="Penetração na base"
            value={fmtPct(ftth?.kpis.penetracaoBase)}
            tone="sky"
          />
        </div>
        <div className="mt-5 grid grid-cols-4 gap-3">
          <MetricCard label="Cobertura" value={fmtInt(ftth?.kpis.cobertura)} />
          <MetricCard label="Renovação" value={fmtInt(ftth?.kpis.renovacao)} />
          <MetricCard label="Sem FTTH no parque" value={fmtInt(ftth?.kpis.semFtthNoParque)} />
          <MetricCard
            label="Convergentes"
            value={fmtInt(ftth?.kpis.convergentes)}
            accent="violet"
          />
        </div>
        <section className="mt-5 rounded-[1.4rem] border border-violet-100 bg-white p-5 shadow-sm">
          <SectionTitle
            icon={<Wifi className="size-4" />}
            eyebrow="Potencial por parceiro"
            title="Aquisição fixa básica"
          />
          <CompactTable
            headers={["Parceiro", "Oportunidades", "Participação no total"]}
            rows={(ftth?.porParceiro ?? []).map((row) => [
              row.parceiro,
              fmtInt(row.oportunidades),
              fmtPct(
                (ftth?.kpis.oportunidades ?? 0)
                  ? row.oportunidades / (ftth?.kpis.oportunidades ?? 1)
                  : null,
              ),
            ])}
            total={[
              "Total",
              fmtInt(ftth?.kpis.oportunidades),
              fmtPct(ftth?.kpis.oportunidades ? 1 : null),
            ]}
          />
        </section>
      </ReportPage>

      <ChapterCoverPage
        id="capitulo-qsc"
        page={towers.length + 8}
        totalPages={totalPages}
        number="04"
        eyebrow="Qualidade e execução"
        title="QSC"
        description="Síntese histórica e indicadores críticos para acompanhar qualidade, execução e pontos de atenção."
        partner={partnerLabel}
        date={reportDate}
        tone="emerald"
      />

      <QscReportPage
        qsc={qsc}
        page={towers.length + 9}
        totalPages={totalPages}
        partner={partnerLabel}
        date={reportDate}
      />
    </main>
  );
}

function CoverReportPage({
  partner,
  date,
  towerCount,
  totalPages,
}: {
  partner: string;
  date: string;
  towerCount: number;
  totalPages: number;
}) {
  return (
    <article
      id="inicio-relatorio"
      className="executive-report-page relative mx-auto mb-6 flex min-h-[790px] max-w-[1120px] scroll-mt-24 flex-col overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#24033b] via-[#4b0a78] to-[#7b117b] p-10 text-white shadow-2xl"
    >
      <div className="absolute -right-28 -top-32 size-[28rem] rounded-full bg-cyan-300/25 blur-3xl" />
      <div className="absolute -bottom-44 -left-36 size-[30rem] rounded-full bg-fuchsia-400/20 blur-3xl" />
      <div className="absolute right-16 top-32 size-52 rounded-full border border-violet-200/20 bg-violet-300/10" />

      <header className="relative flex justify-end border-b border-white/15 pb-5">
        <p className="text-xs font-semibold text-white/80">{date}</p>
      </header>

      <div className="relative flex flex-1 items-center">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.28em] text-sky-200">
            Resumo do parceiro
          </p>
          <h1 className="mt-5 text-6xl font-semibold leading-[0.98] tracking-[-0.05em]">
            Relatório
            <br />
            executivo
          </h1>
          <p className="mt-6 text-2xl font-medium text-white/90">{partner}</p>
          <p className="mt-3 max-w-xl text-sm leading-6 text-violet-100">
            Uma leitura objetiva de produção, acompanhamento comercial, oportunidades e qualidade
            para apoiar a tomada de decisão.
          </p>

          <div className="mt-9 grid max-w-2xl grid-cols-2 gap-3">
            {[
              ["Produção e torres", `${towerCount} torres de serviço`, "#capitulo-producao"],
              ["Portabilidade", "Produção e tendência", "#capitulo-portabilidade"],
              ["Oportunidades", "Móvel, aparelhos e FTTH", "#capitulo-oportunidades"],
              ["QSC", "Qualidade e execução", "#capitulo-qsc"],
            ].map(([title, subtitle, href], index) => (
              <a
                key={title}
                href={href}
                className="group flex items-center gap-3 rounded-2xl border border-violet-200/25 bg-[#3f1763]/90 px-4 py-3 text-white transition hover:-translate-y-0.5 hover:border-cyan-200/70 hover:bg-[#54207b] focus:outline-none focus:ring-2 focus:ring-cyan-200"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-white/10 text-[10px] font-bold text-cyan-100 ring-1 ring-white/15">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>
                  <span className="block text-xs font-semibold">{title}</span>
                  <span className="mt-0.5 block text-[9px] text-violet-100/80">{subtitle}</span>
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>

      <footer className="relative flex items-center justify-between border-t border-white/15 pt-4 text-[10px] text-white/60">
        <span>Material confidencial · uso executivo</span>
        <span>Página 1 de {totalPages} · 2026</span>
      </footer>
    </article>
  );
}

function ChapterCoverPage({
  id,
  page,
  totalPages,
  number,
  eyebrow,
  title,
  description,
  partner,
  date,
  tone,
}: {
  id: string;
  page: number;
  totalPages: number;
  number: string;
  eyebrow: string;
  title: string;
  description: string;
  partner: string;
  date: string;
  tone: "violet" | "sky" | "fuchsia" | "emerald";
}) {
  const tones = {
    violet: "from-[#24033b] via-[#4b0a78] to-[#6f1588] text-violet-100",
    sky: "from-[#061d32] via-[#083d5c] to-[#076a8b] text-cyan-100",
    fuchsia: "from-[#2b062d] via-[#651056] to-[#97136e] text-fuchsia-100",
    emerald: "from-[#06251f] via-[#0b4d3e] to-[#08765c] text-emerald-100",
  } as const;

  return (
    <article
      id={id}
      className={`executive-report-page relative mx-auto mb-6 flex min-h-[790px] max-w-[1120px] scroll-mt-24 flex-col overflow-hidden rounded-[2rem] bg-gradient-to-br p-10 text-white shadow-2xl ${tones[tone]}`}
    >
      <div className="absolute -right-32 -top-32 size-[30rem] rounded-full bg-white/10 blur-3xl" />
      <div className="absolute -bottom-36 -left-28 size-[28rem] rounded-full bg-white/[0.06] blur-2xl" />
      <header className="relative flex items-center justify-between border-b border-white/15 pb-5 text-xs">
        <span className="font-semibold text-white/85">{partner}</span>
        <span className="text-white/65">{date}</span>
      </header>

      <div className="relative flex flex-1 items-center">
        <div className="max-w-3xl">
          <div className="mb-8 flex items-center gap-4">
            <span className="grid size-16 place-items-center rounded-2xl border border-white/20 bg-white/10 text-xl font-semibold">
              {number}
            </span>
            <p className="text-xs font-bold uppercase tracking-[0.28em]">{eyebrow}</p>
          </div>
          <h1 className="max-w-4xl text-6xl font-semibold leading-[0.98] tracking-[-0.05em]">
            {title}
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-7 text-white/75">{description}</p>
        </div>
      </div>

      <footer className="relative flex items-center justify-between border-t border-white/15 pt-4 text-[10px] text-white/60">
        <a href="#inicio-relatorio" className="transition hover:text-white">
          Voltar à capa
        </a>
        <span>
          Página {page} de {totalPages}
        </span>
      </footer>
    </article>
  );
}

function TowerReportPage({
  tower,
  page,
  totalPages,
  partner,
  date,
  selectedCompanies,
  records,
  monthsElapsed,
  period,
}: {
  tower: ServiceTower;
  page: number;
  totalPages: number;
  partner: string;
  date: string;
  selectedCompanies: Set<string>;
  records: SourceRecord[];
  monthsElapsed: number;
  period: string;
}) {
  const ytd = buildYtdSummary(tower, records, monthsElapsed);
  const towerRows = selectedCompanies.size
    ? tower.rows.filter((row) => selectedCompanies.has(normalize(row.partner)))
    : tower.rows;

  return (
    <ReportPage
      page={page}
      totalPages={totalPages}
      title="Produção e acompanhamento comercial"
      eyebrow="Resultado atual"
      partner={partner}
      date={date}
    >
      <div className="grid grid-cols-[1.05fr_1.95fr] gap-4">
        <section className="rounded-[1.4rem] bg-gradient-to-br from-violet-950 via-violet-800 to-fuchsia-700 p-5 text-white shadow-lg">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-100">
            Produto em foco
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">{ytd.product}</h2>
          <p className="mt-2 max-w-sm text-xs leading-5 text-violet-100">
            O resultado YTD/YoY abaixo corresponde à mesma torre exibida no acompanhamento
            comercial.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <MetricCard label="Real YTD" value={fmtDec(ytd.real)} inverse />
            <MetricCard label="Atingimento" value={fmtPct(ytd.attainment)} inverse />
            <MetricCard label="Gap da meta" value={signed(ytd.gap)} inverse />
            <MetricCard label="YoY" value={fmtPct(ytd.yoy)} inverse />
          </div>
        </section>

        <section className="rounded-[1.4rem] border border-violet-100 bg-white p-5 shadow-sm">
          <SectionTitle
            icon={<BarChart3 className="size-4" />}
            eyebrow="Acompanhamento comercial"
            title="Torres de serviço"
          />
          <p className="mt-1 text-xs text-slate-500">{tower.title}</p>
          <CompactTable
            headers={["Parceiro", ...tower.columns.slice(0, 6).map((column) => column.label)]}
            rows={towerRows.map((row) => [
              row.partner,
              ...tower.columns
                .slice(0, 6)
                .map((column) => formatTowerValue(row.values[column.key], column.format)),
            ])}
            empty="Sem dados para o parceiro nesta torre."
          />
        </section>
      </div>

      <section className="mt-4 rounded-[1.4rem] border border-violet-100 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-end justify-between gap-4">
          <SectionTitle icon={<Gauge className="size-4" />} eyebrow="Produção YoY" title={period} />
          <span className="rounded-full bg-violet-50 px-3 py-1 text-[10px] font-semibold text-violet-700">
            Somente {ytd.product}
          </span>
        </div>
        <CompactTable
          headers={["Produto", "Meta", "Real", "%", "Gap TT", "Média/mês", "YoY R$", "YoY %"]}
          rows={[
            [
              ytd.product,
              fmtDec(ytd.meta),
              fmtDec(ytd.real),
              fmtPct(ytd.attainment),
              signed(ytd.gap),
              fmtDec(ytd.average),
              signed(ytd.yoyGap),
              fmtPct(ytd.yoy),
            ],
          ]}
        />
      </section>
    </ReportPage>
  );
}

function QscReportPage({
  qsc,
  page,
  totalPages,
  partner,
  date,
}: {
  qsc: ReturnType<typeof useQsc>["data"];
  page: number;
  totalPages: number;
  partner: string;
  date: string;
}) {
  const competence = qsc?.competence ?? "";
  const metrics = qsc?.metrics ?? [];
  const competencies = semesterCompetencies(competence);
  const rows = DOMAIN_LABELS.map((item) => ({
    ...item,
    ...qscDomainHistory(item.domain, metrics, competencies),
  }));
  const pulse = PULSE_METRICS.flatMap((item) => {
    const metric = metrics.find((candidate) => candidate.id === item.id);
    return metric ? [{ ...item, metric }] : [];
  });

  return (
    <ReportPage
      page={page}
      totalPages={totalPages}
      title="Qualidade e execução"
      eyebrow="QSC"
      partner={partner}
      date={date}
    >
      <section className="rounded-[1.4rem] border border-violet-100 bg-white p-5 shadow-sm">
        <div className="flex items-end justify-between gap-4">
          <SectionTitle
            icon={<ShieldCheck className="size-4" />}
            eyebrow="Histórico consolidado"
            title="Visão histórica por semestre"
          />
          <span className="rounded-full bg-violet-50 px-3 py-1 text-[10px] font-semibold capitalize text-violet-700">
            {competenceLabel(competence)}
          </span>
        </div>
        <CompactTable
          headers={[
            "Indicador",
            ...competencies.map((item) => monthLabel(Number(item.slice(5, 7)))),
            "Totalizador",
            "Pts",
            "Faixa",
          ]}
          rows={rows.map((row) => [
            row.label,
            ...row.values.map(fmtInt),
            fmtInt(row.totalizer),
            fmtInt(row.points),
            row.band,
          ])}
        />
      </section>

      <section className="mt-5">
        <SectionTitle
          icon={<Gauge className="size-4" />}
          eyebrow="Indicadores críticos"
          title="Pulso do mês"
        />
        <div className="mt-3 grid grid-cols-5 gap-3">
          {pulse.map(({ id, label, metric }) => (
            <div
              key={id}
              className="rounded-[1.25rem] border border-slate-200 bg-white p-4 shadow-sm"
            >
              <p className="min-h-7 text-[9px] font-bold uppercase leading-3 tracking-[0.12em] text-slate-500">
                {label}
              </p>
              <div className="mt-2 flex items-end justify-between gap-2">
                <strong className="text-xl tabular-nums text-slate-950">
                  {fmtPct(metric.latest?.value)}
                </strong>
                <span className="rounded-full bg-violet-100 px-2 py-1 text-[9px] font-bold text-violet-700">
                  F{metric.latest?.scoreBand ?? "—"}
                </span>
              </div>
              <div className="mt-3 flex justify-between border-t border-slate-100 pt-2 text-[9px] text-slate-500">
                <span>Nota {metric.latest?.score ?? "—"}</span>
                <span>
                  {fmtInt(metric.latest?.numerator)} / {fmtInt(metric.latest?.denominator)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </ReportPage>
  );
}

function ReportPage({
  page,
  totalPages,
  title,
  eyebrow,
  partner,
  date,
  children,
}: {
  page: number;
  totalPages: number;
  title: string;
  eyebrow: string;
  partner: string;
  date: string;
  children: ReactNode;
}) {
  return (
    <article className="executive-report-page relative mx-auto mb-6 flex min-h-[790px] max-w-[1120px] flex-col overflow-hidden rounded-[2rem] border border-violet-100 bg-[#fbf9ff] p-8 shadow-2xl">
      <div className="absolute -right-24 -top-24 size-72 rounded-full bg-sky-200/35 blur-3xl" />
      <div className="absolute -left-24 top-20 size-64 rounded-full bg-fuchsia-200/25 blur-3xl" />
      <header className="relative mb-5 flex items-start justify-between border-b border-violet-100 pb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-violet-700">
            {eyebrow}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-slate-800">{partner}</p>
          <p className="mt-1 text-[10px] text-slate-500">Relatório executivo · {date}</p>
        </div>
      </header>
      <div className="relative flex-1">{children}</div>
      <footer className="relative mt-4 flex items-center justify-between border-t border-violet-100 pt-3 text-[9px] text-slate-400">
        <span>Visão Carteira · resumo para tomada de decisão</span>
        <span>
          Página {page} de {totalPages}
        </span>
      </footer>
    </article>
  );
}

function SectionTitle({
  icon,
  eyebrow,
  title,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-xl bg-violet-100 text-violet-700">
        {icon}
      </span>
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-violet-700">
          {eyebrow}
        </p>
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  inverse = false,
  accent = "default",
}: {
  label: string;
  value: string;
  inverse?: boolean;
  accent?: "default" | "violet" | "emerald";
}) {
  const color = inverse
    ? "border-white/15 bg-white/10 text-white"
    : accent === "emerald"
      ? "border-emerald-100 bg-emerald-50 text-emerald-800"
      : accent === "violet"
        ? "border-violet-100 bg-violet-50 text-violet-800"
        : "border-slate-200 bg-white text-slate-950";
  return (
    <div className={`rounded-[1.1rem] border p-3 ${color}`}>
      <p
        className={`text-[9px] font-bold uppercase tracking-[0.12em] ${inverse ? "text-violet-100" : "text-slate-500"}`}
      >
        {label}
      </p>
      <strong className="mt-1 block text-lg tabular-nums">{value}</strong>
    </div>
  );
}

function HeroMetric({
  label,
  value,
  tone = "brand",
}: {
  label: string;
  value: string;
  tone?: "brand" | "sky" | "violet";
}) {
  const style =
    tone === "brand"
      ? "from-violet-900 to-fuchsia-600 text-white"
      : tone === "sky"
        ? "from-white to-sky-100 text-slate-950"
        : "from-white to-violet-100 text-slate-950";
  return (
    <div
      className={`rounded-[1.4rem] border border-violet-100 bg-gradient-to-br p-5 shadow-sm ${style}`}
    >
      <p
        className={`text-[9px] font-bold uppercase tracking-[0.14em] ${tone === "brand" ? "text-violet-100" : "text-slate-500"}`}
      >
        {label}
      </p>
      <strong className="mt-3 block text-3xl tracking-tight tabular-nums">{value}</strong>
    </div>
  );
}

function LargeSummary({
  label,
  value,
  tone = "sky",
}: {
  label: string;
  value: string;
  tone?: "sky" | "violet";
}) {
  return (
    <div
      className={`rounded-[1.5rem] border p-5 shadow-sm ${tone === "violet" ? "border-violet-100 bg-gradient-to-br from-white to-violet-100" : "border-sky-100 bg-gradient-to-br from-white to-sky-100"}`}
    >
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <strong className="mt-3 block text-3xl tracking-tight tabular-nums text-slate-950">
        {value}
      </strong>
    </div>
  );
}

function CompactTable({
  headers,
  rows,
  total,
  empty = "Nenhum dado disponível.",
}: {
  headers: string[];
  rows: string[][];
  total?: string[];
  empty?: string;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
      <table className="w-full table-fixed border-collapse bg-white text-[10px]">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            {headers.map((header, index) => (
              <th
                key={`${header}-${index}`}
                className={`px-3 py-2.5 text-left font-bold uppercase tracking-[0.08em] ${index ? "text-right" : ""}`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-slate-100">
                {headers.map((_, index) => (
                  <td
                    key={index}
                    className={`px-3 py-2.5 font-medium tabular-nums text-slate-700 ${index ? "text-right" : "font-semibold text-slate-900"}`}
                  >
                    {row[index] ?? "—"}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr className="border-t border-slate-100">
              <td colSpan={headers.length} className="px-3 py-6 text-center text-slate-500">
                {empty}
              </td>
            </tr>
          )}
          {total && (
            <tr className="border-t-2 border-violet-100 bg-violet-50/70">
              {headers.map((_, index) => (
                <td
                  key={index}
                  className={`px-3 py-2.5 font-bold tabular-nums text-slate-900 ${index ? "text-right" : ""}`}
                >
                  {total[index] ?? "—"}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function signed(value: number | null | undefined) {
  if (value == null) return "—";
  return `${value > 0 ? "+" : ""}${fmtDec(value)}`;
}

function formatTowerValue(value: string | number | null, format: string) {
  if (value == null) return "—";
  if (typeof value === "string") return value;
  return format === "percent" ? fmtPct(value) : fmtDec(value);
}
