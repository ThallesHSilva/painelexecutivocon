import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  Search,
  Minus,
  Target,
  TrendingUp,
  Trophy,
  X,
} from "lucide-react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { usePartnerFilter } from "@/contexts/AppContexts";
import { usePartners } from "@/hooks/useData";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableScroll } from "@/components/TableScroll";
import { EmptyState, ErrorState } from "@/components/EmptyState";
import { fmtBRL, fmtInt, fmtPct } from "@/lib/format";
import { cn } from "@/lib/utils";
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

/**
 * Faixa do quartil de consultor: Q1 é o melhor colocado e Q5 o que tem mais espaço
 * para evolução.
 *
 * Mapa dedicado a esta escala. Não é compartilhado com as faixas do QSC — lá o
 * número da faixa tem outro sentido — e o quartil nunca aparece só como cor: o
 * rótulo "Q1…Q5" acompanha a faixa em todos os lugares. Pares texto/fundo vêm dos
 * tokens semânticos, já verificados nos temas claro e escuro.
 */
const QUARTILE_STYLE = ["quartil-q1", "quartil-q2", "quartil-q3", "quartil-q4", "quartil-q5"];
const QUARTILE_FILL = [
  "quartil-fill-q1",
  "quartil-fill-q2",
  "quartil-fill-q3",
  "quartil-fill-q4",
  "quartil-fill-q5",
];
const QUARTILE_TEXT = [
  "quartil-text-q1",
  "quartil-text-q2",
  "quartil-text-q3",
  "quartil-text-q4",
  "quartil-text-q5",
];

const TABLE_HEADER_CLASS =
  "bg-muted [&_th]:h-auto [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-border [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-xs [&_th]:font-semibold [&_th]:leading-4 [&_th]:text-foreground";
const TABLE_BODY_CLASS =
  "[&_td]:whitespace-nowrap [&_td]:px-3 [&_td]:py-2.5 [&_tr]:border-border [&_tr:hover]:bg-transparent";
/**
 * Identificação persistente: a primeira coluna acompanha a rolagem horizontal para
 * que a linha continue identificável no celular, sem retirar nenhuma coluna. No
 * ranking essa coluna reúne posição, nome e parceiro, o que devolve largura ao nome
 * real do consultor em telas estreitas.
 */
const STICKY_ID_CLASS = "sticky left-0 z-[1] !whitespace-normal";

const labelMonth = (month: string) =>
  month
    ? new Date(`${month}-01T12:00:00Z`).toLocaleDateString("pt-BR", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      })
    : "—";
type EvolutionPeriod = "3" | "6";
type EvolutionStatus = "up" | "down" | "stable" | "missing";
type EvolutionFilter = { period: EvolutionPeriod; status: EvolutionStatus } | null;
const evolutionLabels: Record<EvolutionStatus, string> = {
  up: "Evoluiu",
  down: "Regrediu",
  stable: "Neutro",
  missing: "Sem histórico",
};
/** Quantas competências cada janela usa, incluindo o mês corrente. Regra do cálculo. */
const evolutionWindow: Record<EvolutionPeriod, number> = { "3": 3, "6": 6 };

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

/**
 * Saldo justo da trajetória: cada faixa ganha vale +1 e cada faixa perdida vale
 * -1. Indicadores sem histórico não entram na soma; sem nenhum indicador comparável,
 * o resultado continua sendo "sem histórico".
 */
function netQuartileChange(changes: Record<QuartilMetric, number | null>) {
  const comparable = metrics
    .map((item) => changes[item.id])
    .filter((value): value is number => value !== null);
  return comparable.length ? comparable.reduce((total, value) => total + value, 0) : null;
}

/** Valor do indicador: dinheiro em Receita, contagem em Móvel e FTTH; ausência é "—". */
function metricValue(metric: QuartilMetric, value: number | null | undefined) {
  return metric === "receita" ? fmtBRL(value) : fmtInt(value);
}

/** Participação sobre um total, sem inventar 0% quando não há base para comparar. */
function share(count: number, total: number) {
  return total ? fmtPct(count / total) : "—";
}

function Quartile({ value }: { value: number | null | undefined }) {
  if (!value)
    return (
      <span className="inline-flex min-w-11 justify-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
        Sem Q
      </span>
    );
  return (
    <span
      className={cn(
        "inline-flex min-w-11 justify-center rounded-md border px-2 py-0.5 text-xs font-semibold tabular-nums",
        QUARTILE_STYLE[value - 1],
      )}
    >
      Q{value}
    </span>
  );
}
function Change({ value }: { value: number | null }) {
  const Icon = value === null || value === 0 ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium",
        value === null || value === 0
          ? "text-muted-foreground"
          : value > 0
            ? "text-success"
            : "text-destructive",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {value === null
        ? "Sem histórico"
        : value === 0
          ? "Estável"
          : `${value > 0 ? "Subiu" : "Caiu"} ${Math.abs(value)} ${Math.abs(value) === 1 ? "faixa" : "faixas"}`}
    </span>
  );
}

function Section({
  title,
  actions,
  className,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("quartil-section overflow-hidden", className)}>
      <div className="quartil-section-header flex flex-col gap-3 border-b border-border px-4 py-3.5 md:flex-row md:items-start md:justify-between md:gap-4 md:px-5">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold leading-[22px] text-foreground">{title}</h2>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </Card>
  );
}

function QuartilPage() {
  const { effectiveSelected, selected, role, allowedPartnerIds } = usePartnerFilter();
  const { data: partnerList = [] } = usePartners();
  const [metric, setMetric] = useState<QuartilMetric>("receita");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [evolutionFilter, setEvolutionFilter] = useState<EvolutionFilter>(null);
  const { data, isPending, error, refetch } = useQuery<QuartilSnapshot>({
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
  /**
   * Recorte em texto, sem alterar o filtro: nenhuma seleção continua significando
   * consolidado, e o GN sem seleção continua vendo apenas os parceiros vinculados.
   */
  const selectedNames = useMemo(
    () => selected.map((id) => partnerList.find((partner) => partner.id === id)?.name ?? id),
    [partnerList, selected],
  );
  const allowedCount = allowedPartnerIds?.length ?? 0;
  const hasNoAuthorizedPartners = role === "gn" && allowedCount === 0;
  const scopeLabel = selected.length
    ? selected.length === 1
      ? selectedNames[0]
      : `${selected.length} parceiros selecionados`
    : role === "gn"
      ? `${allowedCount} ${allowedCount === 1 ? "parceiro autorizado" : "parceiros autorizados"}`
      : "Todos os parceiros (consolidado)";
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
  const unclassified = consultants.filter((c) => c.quartiles[metric] === null).length;
  const clearFilters = () => {
    setSearch("");
    setEvolutionFilter(null);
    setPage(0);
    setExpanded(null);
  };

  return (
    <DashboardLayout title="Quartil de Consultores">
      <header className="quartil-page-header mb-6 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="min-w-0">
          <p className="quartil-eyebrow">Performance comercial · matriz Q1–Q5</p>
          <h1 className="text-2xl font-semibold leading-[1.2] tracking-tight text-foreground md:text-[28px] md:leading-[34px]">
            Quartil de Consultores
          </h1>
          <dl className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <div className="flex min-w-0 items-baseline gap-1.5">
              <dt className="font-medium text-foreground">Recorte:</dt>
              <dd className="min-w-0 truncate">{scopeLabel}</dd>
            </div>
            {data?.latestMonth && (
              <div className="flex items-baseline gap-1.5">
                <dt className="font-medium text-foreground">Competência:</dt>
                <dd className="capitalize">{labelMonth(data.latestMonth)}</dd>
              </div>
            )}
            {data?.months?.length ? (
              <div className="flex min-w-0 items-baseline gap-1.5">
                <dt className="font-medium text-foreground">Competências na base:</dt>
                <dd className="min-w-0 truncate capitalize">
                  {data.months.length === 1
                    ? labelMonth(data.months[0])
                    : `${labelMonth(data.months[0])} a ${labelMonth(data.months.at(-1)!)} (${data.months.length})`}
                </dd>
              </div>
            ) : null}
            {data?.latestMonth ? (
              <div className="flex items-baseline gap-1.5">
                <dt className="font-medium text-foreground">Consultores:</dt>
                <dd className="tabular-nums">{fmtInt(consultants.length)}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </header>

      {isPending ? (
        <div className="quartil-page space-y-6">
          <Skeleton className="h-[340px] w-full" />
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-[172px] w-full" />
            <Skeleton className="h-[172px] w-full" />
          </div>
          <Skeleton className="h-[520px] w-full" />
        </div>
      ) : error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : hasNoAuthorizedPartners ? (
        <EmptyState
          title="Nenhum parceiro autorizado"
          description="Seu perfil de GN ainda não possui vínculo com um parceiro. Procure o Diretor para liberar o recorte antes de consultar os quartis."
        />
      ) : !data?.latestMonth ? (
        <EmptyState
          title="Aguardando a base de consultores"
          description="A planilha Quartil, com uma aba por mês, ainda não foi importada para este recorte. Os quartis e o ranking aparecem aqui logo após a importação."
          action={
            <Button asChild variant="outline" size="sm" className="mt-1">
              <Link to="/alimentacao">Abrir Alimentar dados</Link>
            </Button>
          }
        />
      ) : (
        <div className="quartil-page space-y-6">
          {/*
            Escopo do indicador. A seleção recorta distribuição, evolução e as colunas
            de valor/variação do ranking; a ordem do ranking continua vindo da soma dos
            três quartis e não muda com esta escolha.
          */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">
                Indicador da distribuição e da evolução
              </p>
              <p className="page-subtitle mt-1 text-xs text-muted-foreground">
                Altera a distribuição, a evolução e as colunas de valor do indicador. Não altera a
                ordem do ranking geral, que soma os três quartis.
              </p>
            </div>
            <div
              role="group"
              aria-label="Indicador do quartil"
              className="quartil-metric-switcher inline-flex shrink-0 rounded-md border border-border p-0.5"
            >
              {metrics.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setMetric(m.id);
                    setPage(0);
                    setExpanded(null);
                  }}
                  aria-pressed={metric === m.id}
                  className={cn(
                    "rounded-[4px] px-4 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    metric === m.id
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <Section
            className="quartil-distribution"
            title={`Distribuição por parceiro · ${selectedLabel}`}
            description="Q1 reúne o melhor desempenho e Q5 o maior espaço para evolução. As faixas consideram o tempo de casa. Sem classificação é ausência de faixa no mês, diferente de um resultado igual a zero."
          >
            <div className="space-y-4 px-4 py-4 md:px-5">
              {consultants.length > 0 && (
                <div>
                  <div className="flex h-3 overflow-hidden rounded-md bg-muted" aria-hidden>
                    {bandTotals.map((count, i) => (
                      <div
                        key={i}
                        className={QUARTILE_FILL[i]}
                        style={{ width: `${(count / consultants.length) * 100}%` }}
                      />
                    ))}
                  </div>
                  <dl className="mt-3 grid grid-cols-2 justify-items-center gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
                    {bandTotals.map((count, i) => (
                      <div
                        key={i}
                        className="flex min-w-0 flex-col items-center gap-0.5 text-center"
                      >
                        <dt className={cn("text-xs font-semibold", QUARTILE_TEXT[i])}>Q{i + 1}</dt>
                        <dd className="inline-flex items-baseline gap-1.5 text-sm tabular-nums text-foreground">
                          {fmtInt(count)}
                          <span className="text-xs text-muted-foreground">
                            {share(count, consultants.length)}
                          </span>
                        </dd>
                      </div>
                    ))}
                    <div className="flex min-w-0 flex-col items-center gap-0.5 text-center">
                      <dt className="text-xs font-semibold text-muted-foreground">Sem Q</dt>
                      <dd className="inline-flex items-baseline gap-1.5 text-sm tabular-nums text-foreground">
                        {fmtInt(unclassified)}
                        <span className="text-xs text-muted-foreground">
                          {share(unclassified, consultants.length)}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </div>
              )}
              {!distribution.length ? (
                <EmptyState
                  title="Sem consultores no recorte"
                  description="Nenhum consultor da competência atual pertence aos parceiros selecionados. Ajuste ou limpe o filtro de parceiros."
                />
              ) : (
                <TableScroll>
                  <Table className="quartil-table min-w-[860px] table-fixed">
                    <colgroup>
                      <col className="w-[184px] sm:w-[260px]" />
                      <col className="w-[110px]" />
                      <col className="w-[180px]" />
                      {[1, 2, 3, 4, 5].map((q) => (
                        <col key={q} className="w-[72px]" />
                      ))}
                      <col className="w-[130px]" />
                    </colgroup>
                    <TableHeader className={TABLE_HEADER_CLASS}>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className={cn(STICKY_ID_CLASS, "bg-muted")}>Parceiro</TableHead>
                        <TableHead align="numeric">Consultores</TableHead>
                        <TableHead>Distribuição</TableHead>
                        {[1, 2, 3, 4, 5].map((q) => (
                          <TableHead key={q} align="numeric" className={QUARTILE_TEXT[q - 1]}>
                            Q{q}
                          </TableHead>
                        ))}
                        <TableHead align="numeric">Sem classificação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className={TABLE_BODY_CLASS}>
                      {distribution.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell
                            className={cn(STICKY_ID_CLASS, "bg-card font-medium text-foreground")}
                          >
                            {p.name}
                          </TableCell>
                          <TableCell align="numeric">{fmtInt(p.count)}</TableCell>
                          <TableCell>
                            <div className="flex h-2.5 overflow-hidden rounded-md bg-muted">
                              {p.bands.map((n, i) => (
                                <div
                                  key={i}
                                  title={`Q${i + 1}: ${fmtInt(n)} (${share(n, p.count)})`}
                                  className={QUARTILE_FILL[i]}
                                  style={{ width: p.count ? `${(n / p.count) * 100}%` : "0%" }}
                                />
                              ))}
                            </div>
                          </TableCell>
                          {p.bands.map((n, i) => (
                            <TableCell key={i} align="numeric" className="text-foreground">
                              {fmtInt(n)}
                            </TableCell>
                          ))}
                          <TableCell align="numeric" className="text-muted-foreground">
                            {fmtInt(p.missing)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableScroll>
              )}
            </div>
          </Section>

          <div className="grid gap-4 md:grid-cols-2">
            {(["3", "6"] as const).map((period) => {
              const changes = consultants.map((c) => c.comparisons[period].changes[metric]);
              const before = consultants[0]?.comparisons[period].month;
              const beforeInBase = before ? (data.months?.includes(before) ?? false) : false;
              /**
               * Competências reais da base dentro da janela comparada. É leitura, não
               * cálculo: a variação continua vindo de `comparisons[period]`.
               */
              const windowMonths = (data.months ?? []).filter(
                (month) => (!before || month >= before) && month <= data.latestMonth,
              );
              return (
                <Section
                  key={period}
                  className="quartil-evolution"
                  title={`Evolução em ${period} meses · ${selectedLabel}`}
                  description={
                    <>
                      Janela de {evolutionWindow[period]} competências: o mês corrente e os{" "}
                      {evolutionWindow[period] - 1} anteriores. A comparação usa o quartil de{" "}
                      <span className="font-medium capitalize text-foreground">
                        {selectedLabel}
                      </span>{" "}
                      de{" "}
                      <span className="font-medium capitalize text-foreground">
                        {labelMonth(before ?? "")}
                      </span>{" "}
                      contra{" "}
                      <span className="font-medium capitalize text-foreground">
                        {labelMonth(data.latestMonth)}
                      </span>
                      {before && !beforeInBase
                        ? " — essa competência inicial não está na base importada, por isso os consultores sem o mês aparecem como sem histórico."
                        : "."}{" "}
                      {windowMonths.length ? (
                        <>
                          Competências da base nessa janela:{" "}
                          <span className="font-medium capitalize text-foreground">
                            {windowMonths.map((month) => labelMonth(month)).join(", ")}
                          </span>{" "}
                          ({windowMonths.length} de {evolutionWindow[period]}).{" "}
                        </>
                      ) : null}
                      Filtrar aqui recorta a lista do ranking, sem alterar a ordem nem a pontuação
                      do ranking geral.
                    </>
                  }
                >
                  <div className="grid grid-cols-2 gap-2 px-4 py-4 sm:grid-cols-4 md:px-5">
                    {[
                      {
                        status: "up" as const,
                        label: "Evoluiu",
                        count: changes.filter((v) => v !== null && v > 0).length,
                        color: "text-success",
                      },
                      {
                        status: "down" as const,
                        label: "Regrediu",
                        count: changes.filter((v) => v !== null && v < 0).length,
                        color: "text-destructive",
                      },
                      {
                        status: "stable" as const,
                        label: "Neutro",
                        count: changes.filter((v) => v === 0).length,
                        color: "text-foreground",
                      },
                      {
                        status: "missing" as const,
                        label: "Sem histórico",
                        count: changes.filter((v) => v === null).length,
                        color: "text-muted-foreground",
                      },
                    ].map((item) => {
                      const active =
                        evolutionFilter?.period === period &&
                        evolutionFilter.status === item.status;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            setEvolutionFilter((current) =>
                              current?.period === period && current.status === item.status
                                ? null
                                : { period, status: item.status },
                            );
                            setPage(0);
                            setExpanded(null);
                          }}
                          className={cn(
                            "quartil-stat-button rounded-md border px-3 py-2.5 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                            active ? "border-primary bg-selection" : "border-border hover:bg-muted",
                          )}
                        >
                          <p className={cn("text-xl font-semibold tabular-nums", item.color)}>
                            {fmtInt(item.count)}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{item.label}</p>
                        </button>
                      );
                    })}
                  </div>
                </Section>
              );
            })}
          </div>

          <Section
            className="quartil-ranking"
            title="Ranking geral de consultores"
            description="Ordem pela soma dos três quartis, de 0 a 15 pontos: Q1 vale 5, Q2 vale 4, Q3 vale 3, Q4 vale 2, Q5 vale 1 e sem classificação vale 0. Empate é decidido pela maior Receita. A ordem é a mesma para qualquer indicador selecionado; o indicador só define as colunas de valor e variação."
            actions={
              <div className="relative w-full sm:w-72">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  aria-label="Buscar consultor ou parceiro"
                  placeholder="Buscar consultor ou parceiro"
                  className="pl-9"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                />
              </div>
            }
          >
            {evolutionFilter && (
              <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-4 py-2.5 text-xs md:px-5">
                <span className="text-muted-foreground">Recorte da lista:</span>
                <span className="font-medium text-foreground">
                  {evolutionLabels[evolutionFilter.status]} · {selectedLabel} ·{" "}
                  {evolutionFilter.period} meses
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setEvolutionFilter(null);
                    setPage(0);
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 font-medium text-foreground transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Remover
                  <X className="size-3.5" aria-hidden />
                </button>
              </div>
            )}
            {!rows.length ? (
              <div className="px-4 py-4 md:px-5">
                <EmptyState
                  title="Nenhum consultor no recorte"
                  description="A busca e o filtro de evolução foram preservados. Ajuste os termos ou limpe os filtros para ver a lista completa."
                  action={
                    <Button variant="outline" size="sm" className="mt-1" onClick={clearFilters}>
                      Limpar filtros da lista
                    </Button>
                  }
                />
              </div>
            ) : (
              <div className="px-4 py-4 md:px-5">
                <TableScroll hint="Role na horizontal para ver todas as colunas. O consultor permanece visível.">
                  <Table className="quartil-table min-w-[1076px] table-fixed">
                    <colgroup>
                      <col className="w-[196px] sm:w-[268px]" />
                      <col className="w-[92px]" />
                      <col className="w-[132px]" />
                      <col className="w-[84px]" />
                      <col className="w-[84px]" />
                      <col className="w-[84px]" />
                      <col className="w-[132px]" />
                      <col className="w-[136px]" />
                      <col className="w-[136px]" />
                    </colgroup>
                    <TableHeader className={TABLE_HEADER_CLASS}>
                      <TableRow className="hover:bg-transparent">
                        <TableHead className={cn(STICKY_ID_CLASS, "bg-muted")}>
                          Posição e consultor
                        </TableHead>
                        <TableHead align="numeric">Pontos</TableHead>
                        <TableHead>Tempo de casa</TableHead>
                        {metrics.map((m) => (
                          <TableHead key={m.id} align="state">
                            {m.label}
                          </TableHead>
                        ))}
                        <TableHead align="numeric">{selectedLabel} atual</TableHead>
                        <TableHead>Evolução 3 meses</TableHead>
                        <TableHead>Evolução 6 meses</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className={TABLE_BODY_CLASS}>
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
                    </TableBody>
                  </Table>
                </TableScroll>
              </div>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground md:px-5">
              <span>
                <span className="tabular-nums">{fmtInt(rows.length)}</span> de{" "}
                <span className="tabular-nums">{fmtInt(consultants.length)}</span> consultores ·
                página <span className="tabular-nums">{actualPage + 1}</span> de{" "}
                <span className="tabular-nums">{Math.max(1, Math.ceil(rows.length / 20))}</span>
              </span>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={actualPage === 0}
                  onClick={() => setPage(actualPage - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={(actualPage + 1) * 20 >= rows.length}
                  onClick={() => setPage(actualPage + 1)}
                >
                  Próxima
                </Button>
              </div>
            </div>
          </Section>
        </div>
      )}
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
  const netRecentChange = netQuartileChange(c.comparisons["3"].changes);
  const improving = recentChanges.filter((item) => item.value !== null && item.value > 0);
  const declining = recentChanges.filter((item) => item.value !== null && item.value < 0);
  const trendText =
    netRecentChange === null
      ? "Ainda não há histórico suficiente para avaliar a trajetória."
      : netRecentChange > 0
        ? `Saldo positivo: subiu ${netRecentChange} ${netRecentChange === 1 ? "faixa" : "faixas"} no conjunto dos indicadores.`
        : netRecentChange < 0
          ? `Saldo negativo: caiu ${Math.abs(netRecentChange)} ${Math.abs(netRecentChange) === 1 ? "faixa" : "faixas"} no conjunto dos indicadores.`
          : improving.length && declining.length
            ? "Saldo neutro: as evoluções e regressões se compensaram."
            : "Saldo neutro nos últimos 3 meses.";
  const tenureLabel =
    c.tenure === null
      ? "Não informado"
      : c.tenure === "experienced"
        ? "Acima de 3 meses"
        : "Até 3 meses";
  return (
    <>
      <TableRow>
        {/*
          Identificação da linha: posição, consultor e parceiro no mesmo bloco fixo.
          No celular isso devolve largura ao nome real e mantém a linha reconhecível
          durante a rolagem horizontal, sem esconder nenhuma coluna.
        */}
        <TableCell className={cn(STICKY_ID_CLASS, "bg-card align-top")}>
          <button
            type="button"
            className="flex w-full items-start gap-2 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            aria-expanded={expanded}
            onClick={onToggle}
          >
            <ChevronDown
              aria-hidden
              className={cn(
                "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-150",
                expanded && "rotate-180",
              )}
            />
            <span className="min-w-0">
              <span className="block text-xs font-semibold tabular-nums text-muted-foreground">
                {rank}º
              </span>
              <span className="block font-medium text-foreground">{c.name}</span>
              <span className="block text-xs text-muted-foreground">{c.partnerName}</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                {expanded ? "Ocultar análise individual" : "Ver análise individual"}
              </span>
            </span>
          </button>
        </TableCell>
        <TableCell align="numeric" className="align-top font-medium text-foreground">
          {score}
          <span className="text-xs font-normal text-muted-foreground">/15</span>
        </TableCell>
        <TableCell className="align-top text-xs text-muted-foreground">{tenureLabel}</TableCell>
        {metrics.map((m) => (
          <TableCell key={m.id} align="state" className="align-top">
            <Quartile value={c.quartiles[m.id]} />
          </TableCell>
        ))}
        <TableCell align="numeric" className="align-top text-foreground">
          {metricValue(metric, c.values[metric])}
        </TableCell>
        <TableCell className="align-top">
          <Change value={c.comparisons["3"].changes[metric]} />
        </TableCell>
        <TableCell className="align-top">
          <Change value={c.comparisons["6"].changes[metric]} />
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={9} className="bg-muted/40 !whitespace-normal !px-4 !py-4 md:!px-5">
            <h3 className="text-[15px] font-semibold leading-[22px] text-foreground">
              Análise individual · {c.name}
            </h3>
            <dl className="quartil-insight-grid mt-3 grid gap-3 md:grid-cols-3">
              <div className="quartil-insight-card quartil-insight-strength">
                <div className="quartil-insight-heading">
                  <span className="quartil-insight-icon" aria-hidden>
                    <Trophy className="size-4" />
                  </span>
                  <dt>Ponto forte</dt>
                </div>
                <dd className="mt-1 text-sm text-foreground">
                  {bestQuartile === null
                    ? "Dados insuficientes para classificação."
                    : balanced
                      ? `Desempenho equilibrado nos três indicadores · Q${bestQuartile}`
                      : `${strongest.map((item) => item.label).join(" e ")} · Q${bestQuartile}`}
                </dd>
                <dd className="mt-0.5 text-xs text-muted-foreground">
                  Melhor posição atual entre os três indicadores.
                </dd>
              </div>
              <div className="quartil-insight-card quartil-insight-attention">
                <div className="quartil-insight-heading">
                  <span className="quartil-insight-icon" aria-hidden>
                    <Target className="size-4" />
                  </span>
                  <dt>Ponto de atenção</dt>
                </div>
                <dd className="mt-1 text-sm text-foreground">
                  {weakestQuartile === null
                    ? "Dados insuficientes para classificação."
                    : balanced
                      ? `Os três indicadores estão no Q${weakestQuartile}`
                      : `${weakest.map((item) => item.label).join(" e ")} · Q${weakestQuartile}`}
                </dd>
                <dd className="mt-0.5 text-xs text-muted-foreground">
                  Indicador com maior espaço para evolução.
                </dd>
              </div>
              <div className="quartil-insight-card quartil-insight-trajectory">
                <div className="quartil-insight-heading">
                  <span className="quartil-insight-icon" aria-hidden>
                    <TrendingUp className="size-4" />
                  </span>
                  <dt>Trajetória</dt>
                </div>
                <dd className="mt-1 text-sm text-foreground">{trendText}</dd>
                <dd className="mt-0.5 text-xs text-muted-foreground">
                  Leitura baseada na variação dos quartis nos últimos 3 meses.
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-xs text-muted-foreground">
              Histórico por competência: quartil e valor apurado. &quot;Sem dado&quot; indica
              competência sem apuração para este consultor, diferente de um valor igual a zero.
            </p>
            <TableScroll className="mt-2 rounded-md border border-border bg-card">
              <Table className="quartil-table min-w-[640px] table-fixed text-xs">
                <colgroup>
                  <col className="w-[120px]" />
                  {months.map((month) => (
                    <col key={month} className="w-[104px]" />
                  ))}
                </colgroup>
                <TableHeader className={TABLE_HEADER_CLASS}>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className={cn(STICKY_ID_CLASS, "bg-muted")}>Indicador</TableHead>
                    {months.map((month) => (
                      <TableHead key={month} align="state" className="capitalize">
                        {labelMonth(month)}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody className={TABLE_BODY_CLASS}>
                  {metrics.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell
                        className={cn(STICKY_ID_CLASS, "bg-card font-medium text-foreground")}
                      >
                        {m.label}
                      </TableCell>
                      {months.map((month) => {
                        const point = c.history.find((p) => p.month === month);
                        return (
                          <TableCell key={month} align="state">
                            <Quartile value={point?.quartiles[m.id]} />
                            <span className="mt-1 block tabular-nums text-muted-foreground">
                              {point?.values[m.id] == null
                                ? "Sem dado"
                                : metricValue(m.id, point.values[m.id])}
                            </span>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableScroll>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
