import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  Minus,
  Users,
  ChevronDown,
  Search,
  BarChart3,
  Smartphone,
  Wifi,
  Wallet,
  ArrowRight,
  Award,
  Target,
  Activity,
  X,
} from "lucide-react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { usePartnerFilter } from "@/contexts/AppContexts";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { QuartilMetric, QuartilSnapshot } from "@/lib/quartil";

export const Route = createFileRoute("/quartil")({
  head: () => ({ meta: [{ title: "Quartil de Consultores — Mapa Parque" }] }),
  component: QuartilPage,
});
const metrics: { id: QuartilMetric; label: string }[] = [
  { id: "receita", label: "Receita" },
  { id: "movel", label: "Móvel" },
  { id: "ftth", label: "FTTH" },
];
const colors = ["bg-emerald-500", "bg-teal-500", "bg-amber-400", "bg-orange-500", "bg-rose-500"];
const metricIcons = { receita: Wallet, movel: Smartphone, ftth: Wifi };
const badges = [
  "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  "bg-teal-500/10 text-teal-700 dark:text-teal-300",
  "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  "bg-rose-500/10 text-rose-700 dark:text-rose-300",
];
const labelMonth = (month: string) =>
  month
    ? new Date(`${month}-01T12:00:00Z`).toLocaleDateString("pt-BR", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "—";
const number = (value: number) => value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
type EvolutionPeriod = "3" | "6";
type EvolutionStatus = "up" | "down" | "stable" | "missing";
type EvolutionFilter = { period: EvolutionPeriod; status: EvolutionStatus } | null;
const evolutionLabels: Record<EvolutionStatus, string> = {
  up: "Evoluíram",
  down: "Regrediram",
  stable: "Estáveis",
  missing: "Sem histórico",
};

function matchesEvolution(value: number | null, status: EvolutionStatus) {
  if (status === "missing") return value === null;
  if (status === "stable") return value === 0;
  if (status === "up") return value !== null && value > 0;
  return value !== null && value < 0;
}

function quartilePoints(value: number | null) {
  return value === null ? 0 : 6 - value;
}

function consultantScore(consultant: import("@/lib/quartil").QuartilConsultant) {
  return metrics.reduce((total, item) => total + quartilePoints(consultant.quartiles[item.id]), 0);
}
function Badge({ value }: { value: number | null | undefined }) {
  return (
    <span
      className={`inline-flex min-w-10 justify-center rounded-lg px-2 py-1 text-xs font-semibold ${value ? badges[value - 1] : "bg-muted text-muted-foreground"}`}
    >
      {value ? `Q${value}` : "—"}
    </span>
  );
}
function Change({ value }: { value: number | null }) {
  const Icon = value === null || value === 0 ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium ${value === null || value === 0 ? "text-muted-foreground" : value > 0 ? "text-emerald-600" : "text-rose-600"}`}
    >
      <Icon className="size-3.5" />
      {value === null
        ? "Sem histórico"
        : value === 0
          ? "Estável"
          : `${Math.abs(value)} ${Math.abs(value) === 1 ? "faixa" : "faixas"}`}
    </span>
  );
}
function QuartilPage() {
  const { effectiveSelected, role } = usePartnerFilter();
  const [metric, setMetric] = useState<QuartilMetric>("receita");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [evolutionFilter, setEvolutionFilter] = useState<EvolutionFilter>(null);
  const { data, isPending, error } = useQuery<QuartilSnapshot>({
    queryKey: ["quartil", effectiveSelected],
    queryFn: async () => {
      const params = new URLSearchParams();
      effectiveSelected.forEach((id) => params.append("partner", id));
      const response = await fetch(`/api/quartil?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível carregar os quartis.");
      return response.json();
    },
    enabled: role === "director" || role === "gn",
  });
  const consultants = useMemo(() => data?.consultants ?? [], [data]);
  const distribution = useMemo(
    () =>
      [...new Set(consultants.map((c) => c.partnerId))]
        .map((id) => {
          const rows = consultants.filter((c) => c.partnerId === id);
          return {
            id,
            name: rows[0].partnerName,
            count: rows.length,
            bands: Array.from(
              { length: 5 },
              (_, i) => rows.filter((c) => c.quartiles[metric] === i + 1).length,
            ),
            missing: rows.filter((c) => c.quartiles[metric] === null).length,
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [consultants, metric],
  );
  const normalizedSearch = search
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  const rankedConsultants = [...consultants].sort((a, b) => {
    const scoreDifference = consultantScore(b) - consultantScore(a);
    if (scoreDifference) return scoreDifference;
    const revenueDifference = (b.values.receita ?? -Infinity) - (a.values.receita ?? -Infinity);
    return revenueDifference || a.name.localeCompare(b.name);
  });
  const ranking = new Map<string, number>();
  let lastRankedScore: number | undefined;
  let lastRankedRevenue: number | null | undefined;
  let currentRank = 0;
  rankedConsultants.forEach((consultant, index) => {
    const score = consultantScore(consultant);
    const revenue = consultant.values.receita;
    if (lastRankedScore === undefined || score !== lastRankedScore || revenue !== lastRankedRevenue)
      currentRank = index + 1;
    ranking.set(consultant.id, currentRank);
    lastRankedScore = score;
    lastRankedRevenue = revenue;
  });
  const rows = rankedConsultants
    .filter((c) =>
      `${c.name} ${c.partnerName}`
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .includes(normalizedSearch),
    )
    .filter((c) =>
      evolutionFilter
        ? matchesEvolution(
            c.comparisons[evolutionFilter.period].changes[metric],
            evolutionFilter.status,
          )
        : true,
    );
  const actualPage = Math.min(page, Math.max(0, Math.ceil(rows.length / 20) - 1));
  const shown = rows.slice(actualPage * 20, actualPage * 20 + 20);
  const selectedLabel = metrics.find((m) => m.id === metric)!.label;
  const bandTotals = Array.from(
    { length: 5 },
    (_, i) => consultants.filter((c) => c.quartiles[metric] === i + 1).length,
  );
  return (
    <DashboardLayout title="Quartil">
      <div className="space-y-6 [&_table_th]:whitespace-nowrap [&_table_th]:font-medium [&_button]:focus-visible:outline-primary [&_table_tbody_tr]:transition-colors">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Desempenho dos consultores
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              Quartil de Consultores<span className="text-primary">.</span>
            </h1>
          </div>
        </div>
        {isPending ? (
          <Card className="p-8 text-muted-foreground">Carregando quartis…</Card>
        ) : error ? (
          <Card className="p-8 text-destructive">{error.message}</Card>
        ) : !data?.latestMonth ? (
          <Card className="p-8">
            <h2 className="font-semibold">Aguardando a base de consultores</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Importe a planilha Quartil com uma aba por mês em Alimentar dados.
            </p>
            <Link to="/alimentacao" className="mt-4 inline-block text-sm font-medium text-primary">
              Abrir Alimentar dados
            </Link>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card className="relative flex items-center justify-between overflow-hidden rounded-2xl border-primary/20 bg-gradient-to-br from-primary to-violet-950 p-6 text-white shadow-lg shadow-primary/10">
                <div>
                  <p className="text-sm text-white/75">Consultores acompanhados</p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums">
                    {number(consultants.length)}
                  </p>
                </div>
                <Users className="size-10 text-white/40" />
              </Card>
              {metrics.map((m) => {
                const Icon = metricIcons[m.id];
                const count = consultants.filter((c) => c.quartiles[m.id] === 1).length;
                const share = consultants.length ? (count / consultants.length) * 100 : 0;
                return (
                  <Card key={m.id} className="rounded-2xl border-border/60 p-6 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{m.label}</p>
                      <Icon className="size-4 text-primary" />
                    </div>
                    <p className="mt-2 text-3xl font-semibold tabular-nums">
                      {count}
                      <span className="ml-2 text-sm font-normal text-muted-foreground">no Q1</span>
                    </p>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary/70"
                        style={{ width: `${share}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {number(share)}% dos consultores na melhor faixa
                    </p>
                  </Card>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-primary/10 bg-primary/[0.035] p-4">
              <div>
                <p className="text-sm font-semibold">Explore por indicador</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  A seleção atualiza a distribuição e a evolução abaixo.
                </p>
              </div>
              <div
                className="inline-flex rounded-xl border bg-muted/40 p-1"
                aria-label="Indicador do quartil"
              >
                {metrics.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setMetric(m.id);
                      setPage(0);
                      setExpanded(null);
                    }}
                    aria-pressed={metric === m.id}
                    className={`rounded-lg px-5 py-2.5 text-sm font-medium transition ${metric === m.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
              <div className="space-y-5 border-b p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 font-semibold">
                    <BarChart3 className="size-4 text-primary" />
                    Distribuição por parceiro
                  </h2>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {selectedLabel}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {bandTotals.map((count, i) => (
                    <div key={i} className="rounded-xl border border-border/50 bg-muted/20 p-3">
                      <div className="flex items-center justify-between">
                        <Badge value={i + 1} />
                        <span className="text-lg font-semibold tabular-nums">{count}</span>
                      </div>
                      <div className="mt-3 h-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full ${colors[i]}`}
                          style={{
                            width: `${consultants.length ? (count / consultants.length) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {number(consultants.length ? (count / consultants.length) * 100 : 0)}% da
                        equipe
                      </p>
                    </div>
                  ))}
                </div>
                <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-emerald-700 dark:text-emerald-300">
                    Q1 · melhor desempenho
                  </span>
                  <ArrowRight className="size-3" />
                  <span>Q5 · maior espaço para evolução</span>
                  <span className="sm:ml-auto">Faixas conforme o tempo de casa</span>
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-5 py-3 text-left">Parceiro</th>
                      <th className="px-3 py-3 text-center">Consultores</th>
                      <th className="w-[25%] px-4 py-3 text-left">Distribuição</th>
                      {[1, 2, 3, 4, 5].map((q) => (
                        <th key={q} className="px-3 py-3 text-center">
                          Q{q}
                        </th>
                      ))}
                      <th className="px-3 py-3 text-center">Sem classificação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distribution.map((p) => (
                      <tr key={p.id} className="border-t border-border/50">
                        <td className="px-5 py-4 font-medium">{p.name}</td>
                        <td className="px-3 py-4 text-center tabular-nums">{p.count}</td>
                        <td className="px-4 py-4">
                          <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                            {p.bands.map((n, i) => (
                              <div
                                key={i}
                                title={`Q${i + 1}: ${n} (${number((n / p.count) * 100)}%)`}
                                className={colors[i]}
                                style={{ width: `${(n / p.count) * 100}%` }}
                              />
                            ))}
                          </div>
                        </td>
                        {p.bands.map((n, i) => (
                          <td key={i} className="px-3 py-4 text-center tabular-nums">
                            <span className={`rounded-lg px-2.5 py-1 font-semibold ${badges[i]}`}>
                              {n}
                            </span>
                          </td>
                        ))}
                        <td className="px-3 py-4 text-center tabular-nums text-muted-foreground">
                          {p.missing || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!distribution.length && (
                <p className="p-6 text-sm text-muted-foreground">
                  Nenhum consultor do mês atual para os parceiros selecionados.
                </p>
              )}
            </Card>
            <div className="grid gap-4 md:grid-cols-2">
              {(["3", "6"] as const).map((period) => {
                const changes = consultants.map((c) => c.comparisons[period].changes[metric]);
                const before = consultants[0]?.comparisons[period].month;
                return (
                  <Card key={period} className="rounded-2xl border-border/60 p-5 shadow-sm sm:p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h2 className="font-semibold">Evolução em {period} meses</h2>
                      <span className="text-xs text-muted-foreground">
                        {before ? `${labelMonth(before)} → ${labelMonth(data.latestMonth)}` : "—"}
                      </span>
                    </div>
                    <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {[
                        {
                          status: "up" as const,
                          label: "Evoluíram",
                          count: changes.filter((v) => v !== null && v > 0).length,
                          color: "text-emerald-600",
                        },
                        {
                          status: "down" as const,
                          label: "Regrediram",
                          count: changes.filter((v) => v !== null && v < 0).length,
                          color: "text-rose-600",
                        },
                        {
                          status: "stable" as const,
                          label: "Estáveis",
                          count: changes.filter((v) => v === 0).length,
                          color: "text-foreground",
                        },
                        {
                          status: "missing" as const,
                          label: "Sem histórico",
                          count: changes.filter((v) => v === null).length,
                          color: "text-muted-foreground",
                        },
                      ].map((item) => (
                        <button
                          key={item.label}
                          type="button"
                          aria-pressed={
                            evolutionFilter?.period === period &&
                            evolutionFilter.status === item.status
                          }
                          onClick={() => {
                            setEvolutionFilter((current) =>
                              current?.period === period && current.status === item.status
                                ? null
                                : { period, status: item.status },
                            );
                            setPage(0);
                            setExpanded(null);
                          }}
                          className={`rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${
                            evolutionFilter?.period === period &&
                            evolutionFilter.status === item.status
                              ? "border-primary bg-primary/[0.08] ring-2 ring-primary/15"
                              : "border-transparent bg-muted/35 hover:border-primary/20"
                          }`}
                        >
                          <p className={`text-2xl font-semibold tabular-nums ${item.color}`}>
                            {item.count}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
                        </button>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
            <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">Ranking de consultores</h2>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
                      Geral · até 15 pontos
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Soma dos três quartis: Q1 vale 5 pontos, Q2 vale 4, Q3 vale 3, Q4 vale 2 e Q5
                    vale 1. Sem classificação vale 0. Em caso de empate, a maior Receita define a
                    posição.
                  </p>
                  {evolutionFilter && (
                    <button
                      type="button"
                      onClick={() => {
                        setEvolutionFilter(null);
                        setPage(0);
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground"
                    >
                      {evolutionLabels[evolutionFilter.status]} · {selectedLabel} ·{" "}
                      {evolutionFilter.period} meses
                      <X className="size-3.5" />
                    </button>
                  )}
                </div>
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />
                  <Input
                    aria-label="Buscar consultor"
                    placeholder="Buscar consultor ou parceiro"
                    className="pl-9"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(0);
                    }}
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px] text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-3 text-center">Posição</th>
                      <th className="px-3 py-3 text-center">Pontos</th>
                      <th className="px-5 py-3 text-left">Consultor / parceiro</th>
                      <th className="px-3 py-3 text-center">Tempo de casa</th>
                      {metrics.map((m) => (
                        <th key={m.id} className="px-3 py-3 text-center">
                          {m.label}
                        </th>
                      ))}
                      <th className="px-3 py-3 text-right">
                        {metrics.find((m) => m.id === metric)?.label} atual
                      </th>
                      <th className="px-4 py-3 text-center">Evolução 3 meses</th>
                      <th className="px-4 py-3 text-center">Evolução 6 meses</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((c) => (
                      <ConsultantRows
                        key={c.id}
                        consultant={c}
                        rank={ranking.get(c.id) ?? 0}
                        score={consultantScore(c)}
                        metric={metric}
                        months={data.months.slice(-7)}
                        expanded={expanded === c.id}
                        onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
                      />
                    ))}
                  </tbody>
                </table>
                {!rows.length && (
                  <p className="p-8 text-center text-sm text-muted-foreground">
                    Nenhum consultor corresponde aos filtros aplicados.
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between border-t px-5 py-3 text-xs text-muted-foreground">
                <span>
                  {rows.length} consultores · página {actualPage + 1} de{" "}
                  {Math.max(1, Math.ceil(rows.length / 20))}
                </span>
                <div className="flex gap-4">
                  <button
                    disabled={actualPage === 0}
                    onClick={() => setPage(actualPage - 1)}
                    className="rounded-lg border px-3 py-2 hover:bg-muted disabled:opacity-30"
                  >
                    Anterior
                  </button>
                  <button
                    disabled={(actualPage + 1) * 20 >= rows.length}
                    onClick={() => setPage(actualPage + 1)}
                    className="rounded-lg border px-3 py-2 hover:bg-muted disabled:opacity-30"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function ConsultantRows({
  consultant: c,
  rank,
  score,
  metric,
  months,
  expanded,
  onToggle,
}: {
  consultant: import("@/lib/quartil").QuartilConsultant;
  rank: number;
  score: number;
  metric: QuartilMetric;
  months: string[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const classified = metrics
    .map((item) => ({ ...item, quartile: c.quartiles[item.id] }))
    .filter(
      (item): item is (typeof metrics)[number] & { quartile: number } => item.quartile !== null,
    );
  const bestQuartile = classified.length
    ? Math.min(...classified.map((item) => item.quartile))
    : null;
  const weakestQuartile = classified.length
    ? Math.max(...classified.map((item) => item.quartile))
    : null;
  const strongest = classified.filter((item) => item.quartile === bestQuartile);
  const weakest = classified.filter((item) => item.quartile === weakestQuartile);
  const balanced = bestQuartile !== null && bestQuartile === weakestQuartile;
  const recentChanges = metrics.map((item) => ({
    label: item.label,
    value: c.comparisons["3"].changes[item.id],
  }));
  const improving = recentChanges.filter((item) => item.value !== null && item.value > 0);
  const declining = recentChanges.filter((item) => item.value !== null && item.value < 0);
  const trendText =
    improving.length && declining.length
      ? `Evolução em ${improving.map((item) => item.label).join(", ")} e regressão em ${declining.map((item) => item.label).join(", ")}.`
      : improving.length
        ? `Evolução em ${improving.map((item) => item.label).join(", ")} nos últimos 3 meses.`
        : declining.length
          ? `Regressão em ${declining.map((item) => item.label).join(", ")} nos últimos 3 meses.`
          : recentChanges.every((item) => item.value === null)
            ? "Ainda não há histórico suficiente para avaliar a trajetória."
            : "Desempenho estável nos últimos 3 meses.";
  const rankStyle =
    rank === 1
      ? "bg-amber-400/20 text-amber-700 dark:text-amber-300"
      : rank === 2
        ? "bg-slate-400/20 text-slate-700 dark:text-slate-300"
        : rank === 3
          ? "bg-orange-500/15 text-orange-700 dark:text-orange-300"
          : "bg-muted text-muted-foreground";
  return (
    <>
      <tr className="border-t border-border/50 hover:bg-muted/20">
        <td className="px-3 py-3 text-center">
          <span
            className={`inline-flex min-w-9 items-center justify-center rounded-lg px-2 py-1 text-xs font-bold tabular-nums ${rankStyle}`}
          >
            {rank}º
          </span>
        </td>
        <td className="px-3 py-3 text-center">
          <span className="inline-flex min-w-12 items-center justify-center rounded-lg bg-primary/10 px-2 py-1 text-xs font-bold text-primary tabular-nums">
            {score}/15
          </span>
        </td>
        <td className="px-5 py-3">
          <button
            className="flex items-center gap-2 text-left"
            aria-expanded={expanded}
            onClick={onToggle}
          >
            <ChevronDown
              className={`size-4 shrink-0 text-primary transition ${expanded ? "rotate-180" : ""}`}
            />
            <span>
              <span className="block font-medium">{c.name}</span>
              <span className="text-xs text-muted-foreground">{c.partnerName}</span>
            </span>
          </button>
        </td>
        <td className="px-3 py-3 text-center text-xs text-muted-foreground">
          {c.tenure === null
            ? "Não informado"
            : c.tenure === "experienced"
              ? "Acima de 3 meses"
              : "Até 3 meses"}
        </td>
        {metrics.map((m) => (
          <td key={m.id} className="px-3 py-3 text-center">
            <Badge value={c.quartiles[m.id]} />
          </td>
        ))}
        <td className="px-3 py-3 text-right tabular-nums">
          {c.values[metric] === null
            ? "—"
            : `${metric === "receita" ? "R$ " : ""}${number(c.values[metric])}`}
        </td>
        <td className="px-4 py-3 text-center">
          <Change value={c.comparisons["3"].changes[metric]} />
        </td>
        <td className="px-4 py-3 text-center">
          <Change value={c.comparisons["6"].changes[metric]} />
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={10} className="bg-primary/[0.025] px-6 py-5">
            <div className="mb-5 grid gap-3 lg:grid-cols-3">
              <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.06] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  <Award className="size-4" /> Ponto forte
                </div>
                <p className="mt-2 text-sm font-medium">
                  {bestQuartile === null
                    ? "Dados insuficientes para classificação."
                    : balanced
                      ? `Desempenho equilibrado nos três indicadores · Q${bestQuartile}`
                      : `${strongest.map((item) => item.label).join(" e ")} · Q${bestQuartile}`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Melhor posição atual entre os três indicadores.
                </p>
              </div>
              <div className="rounded-xl border border-orange-500/15 bg-orange-500/[0.06] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-300">
                  <Target className="size-4" /> Ponto de atenção
                </div>
                <p className="mt-2 text-sm font-medium">
                  {weakestQuartile === null
                    ? "Dados insuficientes para classificação."
                    : balanced
                      ? `Os três indicadores estão no Q${weakestQuartile}`
                      : `${weakest.map((item) => item.label).join(" e ")} · Q${weakestQuartile}`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Indicador com maior espaço para evolução.
                </p>
              </div>
              <div className="rounded-xl border border-primary/15 bg-primary/[0.06] p-4">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-primary">
                  <Activity className="size-4" /> Trajetória
                </div>
                <p className="mt-2 text-sm font-medium">{trendText}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Leitura baseada na variação dos quartis.
                </p>
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border bg-card/70">
              <table className="w-full min-w-[720px] text-xs">
                <thead>
                  <tr>
                    <th className="p-2 text-left">Histórico</th>
                    {months.map((month) => (
                      <th key={month} className="p-2 text-center capitalize">
                        {labelMonth(month)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => (
                    <tr key={m.id}>
                      <td className="p-2 font-medium">{m.label}</td>
                      {months.map((month) => {
                        const point = c.history.find((p) => p.month === month);
                        return (
                          <td key={month} className="p-2 text-center">
                            <Badge value={point?.quartiles[m.id]} />
                            <span className="mt-1 block text-muted-foreground tabular-nums">
                              {point?.values[m.id] != null
                                ? number(point.values[m.id]!)
                                : "Sem dado"}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
