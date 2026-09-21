import { createFileRoute } from "@tanstack/react-router";
import { Fragment, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  ChevronDown,
  RefreshCw,
  Smartphone,
  UsersRound,
  Wifi,
  type LucideProps,
} from "lucide-react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { usePartnerFilter } from "@/contexts/AppContexts";
import { usePartners, useQsc } from "@/hooks/useData";
import { EmptyState, ErrorState } from "@/components/EmptyState";
import { TableScroll } from "@/components/TableScroll";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtInt } from "@/lib/format";
import type { QscDomain, QscMetricPoint, QscMetricSeries } from "@/lib/qsc";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/qsc")({
  head: () => ({ meta: [{ title: "QSC — Mapa Parque" }] }),
  component: QscPage,
});

const DOMAIN_META: Record<
  QscDomain,
  {
    label: string;
    context: string;
    icon: ComponentType<LucideProps>;
  }
> = {
  carteira: {
    label: "QSC Carteira",
    context: "Manutenção e fidelização da base",
    icon: UsersRound,
  },
  fixa: {
    label: "QSC Banda Larga",
    context: "Qualidade das vendas fixas",
    icon: Wifi,
  },
  movel: {
    label: "QSC Móvel",
    context: "Performance e experiência móvel",
    icon: Smartphone,
  },
};

/**
 * Faixa do indicador: qualifica um KPI isolado, em que 1 é o melhor resultado.
 *
 * Este mapa é independente do mapa da nota consolidada e os dois nunca devem ser
 * compartilhados: o número da faixa tem sentidos opostos nas duas escalas. Além da
 * cor, a faixa do indicador sempre aparece como pílula com a palavra "Faixa".
 * Par texto/fundo verificado nos dois temas.
 */
const INDICATOR_BAND_STYLE: Record<string, string> = {
  "1": "border-success/30 bg-success/10 text-success",
  "2": "border-warning/30 bg-warning/10 text-warning",
  "3": "border-critical/30 bg-critical/10 text-critical",
  "4": "border-destructive/30 bg-destructive/10 text-destructive",
};
const INDICATOR_BAND_FALLBACK = "border-border bg-muted text-muted-foreground";

/**
 * Faixa da nota consolidada: qualifica a soma das notas do domínio, em que 5 é o
 * melhor resultado. Escala de cinco degraus aprovada no design (verde, teal, âmbar,
 * laranja e vermelho). Apresentada em bloco retangular com barra lateral, forma
 * deliberadamente diferente da pílula usada na faixa do indicador.
 */
const TOTAL_BAND_STYLE: Record<string, string> = {
  "Faixa 5": "border-success/40 bg-success/10 text-success",
  "Faixa 4": "border-info/40 bg-info/10 text-info",
  "Faixa 3": "border-warning/40 bg-warning/10 text-warning",
  "Faixa 2": "border-critical/40 bg-critical/10 text-critical",
  "Faixa 1": "border-destructive/40 bg-destructive/10 text-destructive",
  "Sem faixa": "border-border bg-muted text-muted-foreground",
};

const TABLE_HEADER_CLASS =
  "bg-muted [&_th]:h-auto [&_th]:whitespace-nowrap [&_th]:border-b [&_th]:border-border [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-xs [&_th]:font-semibold [&_th]:leading-4 [&_th]:text-foreground";
const TABLE_BODY_CLASS =
  "[&_td]:whitespace-nowrap [&_td]:px-3 [&_td]:py-2.5 [&_tr]:border-border [&_tr:hover]:bg-transparent";
/**
 * Identificação persistente: a primeira coluna acompanha a rolagem horizontal para
 * que a linha continue identificável no celular, sem retirar nenhuma coluna.
 */
const STICKY_ID_CLASS = "sticky left-0 z-[1] !whitespace-normal";
const STICKY_ID_WIDTH = "w-[184px] sm:w-[260px]";

const PULSE_METRIC_IDS = [
  "early-churn-fixa",
  "early-churn-movel",
  "churn-bl",
  "churn-movel",
  "saldo-portabilidade",
] as const;

const qscPercentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fmtQscPct = (value: number | null | undefined) =>
  value == null || !Number.isFinite(value) ? "—" : qscPercentFormatter.format(value);

const maximumMetricScore = (metric: QscMetricSeries) =>
  Math.max(0, ...metric.scoreRules.map((rule) => rule.score));

/**
 * Disponibilidade do ponto, em três estados distintos.
 *
 * `missing` é ausência de base para a competência; `zero-park` é parque zero, em que
 * numerador e denominador existem mas a razão não é calculável; `available` inclui o
 * zero real, que continua sendo um resultado legítimo e nunca vira "—".
 */
type PointState = "available" | "missing" | "zero-park";

function pointState(point: QscMetricPoint | null | undefined): PointState {
  if (!point || !point.available) return "missing";
  if (point.zeroPark) return "zero-park";
  return "available";
}

const POINT_STATE_LABEL: Record<PointState, string> = {
  available: "Disponível",
  missing: "Sem base",
  "zero-park": "Parque zero",
};

function qscTotalRatingFromTotal(total: number | null) {
  if (total === null) return null;

  if (total >= 90) return { total, band: "Faixa 5", points: 1000 };
  if (total >= 80) return { total, band: "Faixa 4", points: 800 };
  if (total >= 70) return { total, band: "Faixa 3", points: 600 };
  if (total >= 60) return { total, band: "Faixa 2", points: 400 };
  if (total >= 50) return { total, band: "Faixa 1", points: 200 };
  return { total, band: "Sem faixa", points: 0 };
}

function qscTotalRating(metrics: QscMetricSeries[]) {
  const scores = metrics.flatMap((metric) =>
    metric.latest?.score == null ? [] : metric.latest.score,
  );
  return qscTotalRatingFromTotal(
    scores.length ? scores.reduce((sum, score) => sum + score, 0) : null,
  );
}

function formatCompetence(competence?: string) {
  if (!competence) return "Sem competência";
  const [year, month] = competence.split("-").map(Number);
  if (!year || !month) return competence;
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" })
    .format(new Date(year, month - 1, 1))
    .replace(" de ", "/")
    .replace(".", "");
}

function formatUpdatedAt(value?: string) {
  if (!value) return "Aguardando atualização";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data indisponível";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(" de ", " ")
    .replace(",", " •");
}

/** Faixa do indicador. Pílula com a palavra, nunca só a cor. */
function IndicatorBand({ band }: { band: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold leading-4",
        INDICATOR_BAND_STYLE[band] ?? INDICATOR_BAND_FALLBACK,
      )}
    >
      Faixa {band}
    </span>
  );
}

/** Faixa da nota consolidada. Bloco com barra lateral, distinto da pílula acima. */
function ConsolidatedBand({ band }: { band: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-l-4 px-2 py-0.5 text-xs font-semibold leading-4",
        TOTAL_BAND_STYLE[band] ?? TOTAL_BAND_STYLE["Sem faixa"],
      )}
    >
      {band}
    </span>
  );
}

/** Estado de indisponibilidade dentro da tabela: palavra curta, sem cor de resultado. */
function UnavailableTag({ state }: { state: Exclude<PointState, "available"> }) {
  return (
    <span className="inline-flex items-center rounded-md border border-dashed border-border px-2 py-0.5 text-xs font-medium leading-4 text-muted-foreground">
      {POINT_STATE_LABEL[state]}
    </span>
  );
}

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

/**
 * Célula de nota: valor atual e máximo possível do indicador, alinhados à direita,
 * com o máximo em peso menor para não competir com a nota apurada.
 */
function scoreContent(score: number | null | undefined, maximumScore: number) {
  if (score == null) return <span className="text-muted-foreground">—</span>;
  return (
    <span>
      {fmtInt(score)}
      <span className="font-normal text-muted-foreground">/{fmtInt(maximumScore)}</span>
    </span>
  );
}

/**
 * Linha de indicador e linhas de histórico usam a mesma tabela, as mesmas colunas e
 * o mesmo alinhamento. O histórico é só um recuo na coluna de identificação, para
 * que a leitura de KPI1, KPI2, % e nota não mude ao expandir.
 */
function MetricCells({
  point,
  maximumScore,
}: {
  point: QscMetricPoint | null;
  maximumScore: number;
}) {
  const state = pointState(point);
  const available = state === "available";

  return (
    <>
      <TableCell align="numeric">{available ? fmtInt(point?.numerator) : "—"}</TableCell>
      <TableCell align="numeric">{available ? fmtInt(point?.denominator) : "—"}</TableCell>
      <TableCell align="numeric" className="font-semibold text-foreground">
        {available ? fmtQscPct(point?.value) : "—"}
      </TableCell>
      <TableCell align="numeric" className="font-semibold text-foreground">
        {available ? scoreContent(point?.score, maximumScore) : "—"}
      </TableCell>
      <TableCell align="state">
        {available ? (
          point?.scoreBand ? (
            <IndicatorBand band={point.scoreBand} />
          ) : (
            <span className="text-muted-foreground">—</span>
          )
        ) : (
          <UnavailableTag state={state} />
        )}
      </TableCell>
    </>
  );
}

/**
 * Limites da regra chegam em pontos percentuais (0 a 100), enquanto o valor apurado
 * chega como razão. A conversão aqui é só de apresentação; a comparação continua
 * sendo feita pela API, que é a única dona da fórmula.
 */
function formatRuleRange(rule: { start: number; end: number }, isLast: boolean) {
  if (isLast) return `a partir de ${fmtQscPct(rule.start / 100)}`;
  return `${fmtQscPct(rule.start / 100)} a ${fmtQscPct(rule.end / 100)}`;
}

/**
 * Regra do indicador exposta junto do histórico: fórmula, leitura e a tabela de
 * pontuação que produz a nota e a faixa. Apenas reapresenta o contrato já recebido
 * da API; nenhum valor é recalculado aqui.
 */
function MetricRules({ metric }: { metric: QscMetricSeries }) {
  return (
    <div className="space-y-2.5 text-xs leading-5">
      <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="font-semibold text-foreground">Fórmula</dt>
          <dd className="break-words text-muted-foreground">{metric.formula}</dd>
        </div>
        <div className="min-w-0">
          <dt className="font-semibold text-foreground">Leitura</dt>
          <dd className="break-words text-muted-foreground">
            {metric.interpretation}
            {" · "}
            {metric.favorableDirection === "down" ? "menor é melhor" : "maior é melhor"}
          </dd>
        </div>
      </dl>
      {metric.scoreRules.length > 0 && (
        <div>
          <p className="font-semibold text-foreground">Pontuação por faixa</p>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {metric.scoreRules.map((rule, index) => (
              <li
                key={`${rule.band}-${rule.start}-${rule.end}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1"
              >
                <IndicatorBand band={rule.band} />
                <span className="tabular-nums text-muted-foreground">
                  {formatRuleRange(rule, index === metric.scoreRules.length - 1)}
                </span>
                <span className="font-semibold tabular-nums text-foreground">
                  {fmtInt(rule.score)} pts
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function DomainPanel({
  domain,
  metrics,
  competence,
}: {
  domain: QscDomain;
  metrics: QscMetricSeries[];
  competence: string;
}) {
  const meta = DOMAIN_META[domain];
  const Icon = meta.icon;
  const [expandedMetricId, setExpandedMetricId] = useState<string | null>(null);
  const rating = qscTotalRating(metrics);
  const unavailableCount = metrics.filter(
    (metric) => pointState(metric.latest) !== "available",
  ).length;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-3.5 md:flex-row md:items-start md:justify-between md:gap-4 md:px-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-lg font-semibold leading-[1.45] tracking-tight text-foreground">
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            {meta.label}
          </h2>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {meta.context} · competência {formatCompetence(competence)} · {fmtInt(metrics.length)}{" "}
            indicadores
            {unavailableCount > 0 && ` · ${fmtInt(unavailableCount)} sem base`}
          </p>
        </div>
        {rating ? (
          <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 md:justify-end">
            <span className="text-xs text-muted-foreground">Nota consolidada</span>
            <span className="text-lg font-semibold tabular-nums text-foreground">
              {fmtInt(rating.total)}
            </span>
            <ConsolidatedBand band={rating.band} />
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {fmtInt(rating.points)} pts
            </span>
          </div>
        ) : (
          <p className="shrink-0 text-xs text-muted-foreground md:text-right">
            Nota consolidada indisponível: nenhum indicador apurado nesta competência.
          </p>
        )}
      </div>

      <div className="p-4 md:p-5">
        {metrics.length === 0 ? (
          <EmptyState
            title="Sem indicadores no recorte"
            description="Nenhum indicador deste grupo foi apurado para os parceiros selecionados. Ajuste ou limpe o filtro de parceiros."
          />
        ) : (
          <TableScroll>
            <Table className="min-w-[812px] table-fixed">
              <colgroup>
                <col className={STICKY_ID_WIDTH} />
                <col className="w-[120px]" />
                <col className="w-[120px]" />
                <col className="w-[120px]" />
                <col className="w-[110px]" />
                <col className="w-[118px]" />
              </colgroup>
              <TableHeader className={TABLE_HEADER_CLASS}>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={cn(STICKY_ID_CLASS, "bg-muted")}>Indicador</TableHead>
                  <TableHead align="numeric">KPI1</TableHead>
                  <TableHead align="numeric">KPI2</TableHead>
                  <TableHead align="numeric">%</TableHead>
                  <TableHead align="numeric">Nota / máx.</TableHead>
                  <TableHead align="state">Faixa do indicador</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className={TABLE_BODY_CLASS}>
                {metrics.map((metric) => {
                  const isExpanded = expandedMetricId === metric.id;
                  const history = metric.history.slice(-6);
                  const maximumScore = maximumMetricScore(metric);

                  return (
                    <Fragment key={metric.id}>
                      <TableRow>
                        <TableCell
                          className={cn(
                            STICKY_ID_CLASS,
                            "font-medium text-foreground",
                            isExpanded ? "bg-muted" : "bg-card",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setExpandedMetricId(isExpanded ? null : metric.id)}
                            aria-expanded={isExpanded}
                            aria-controls={`${metric.id}-detalhe`}
                            className="flex w-full items-start gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          >
                            <ChevronDown
                              aria-hidden="true"
                              className={cn(
                                "mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-150",
                                isExpanded && "rotate-180",
                              )}
                            />
                            <span className="min-w-0 break-words">{metric.label}</span>
                          </button>
                        </TableCell>
                        <MetricCells point={metric.latest} maximumScore={maximumScore} />
                      </TableRow>
                      {isExpanded && (
                        <>
                          <TableRow id={`${metric.id}-detalhe`} className="bg-muted/40">
                            <TableCell colSpan={6} className="!whitespace-normal">
                              <MetricRules metric={metric} />
                            </TableCell>
                          </TableRow>
                          {history.length === 0 ? (
                            <TableRow className="bg-muted/40">
                              <TableCell
                                colSpan={6}
                                className="!whitespace-normal text-xs text-muted-foreground"
                              >
                                Sem histórico disponível para {metric.label}.
                              </TableCell>
                            </TableRow>
                          ) : (
                            history.map((point) => (
                              <TableRow
                                key={`${metric.id}-${point.competence}`}
                                className="bg-muted/40"
                              >
                                <TableCell
                                  className={cn(
                                    STICKY_ID_CLASS,
                                    "bg-muted pl-9 text-xs font-medium text-muted-foreground",
                                  )}
                                >
                                  Histórico · {formatCompetence(point.competence)}
                                </TableCell>
                                <MetricCells point={point} maximumScore={maximumScore} />
                              </TableRow>
                            ))
                          )}
                        </>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableScroll>
        )}
      </div>
    </Card>
  );
}

const SEMESTER_DOMAINS: Array<{ domain: QscDomain; label: string }> = [
  { domain: "carteira", label: "QSC Carteira" },
  { domain: "fixa", label: "QSC Fixa" },
  { domain: "movel", label: "QSC Móvel" },
];

function semesterCompetencies(currentCompetence: string, semester: 1 | 2) {
  const year = Number(currentCompetence.slice(0, 4)) || new Date().getFullYear();
  const firstMonth = semester === 1 ? 1 : 7;
  return Array.from(
    { length: 6 },
    (_, index) => `${year}-${String(firstMonth + index).padStart(2, "0")}`,
  );
}

function qscHistoryRow(domain: QscDomain, metrics: QscMetricSeries[], competencies: string[]) {
  const domainMetrics = metrics.filter((metric) => metric.domain === domain);
  const values = competencies.map((competence) => {
    const scores = domainMetrics.flatMap((metric) => {
      const score = metric.history.find((point) => point.competence === competence)?.score;
      return score == null ? [] : score;
    });
    return scores.length ? scores.reduce((sum, score) => sum + score, 0) : null;
  });
  const availableValues = values.filter((value): value is number => value !== null);
  const totalizer = availableValues.length
    ? Math.round(availableValues.reduce((sum, value) => sum + value, 0) / availableValues.length)
    : null;

  return {
    values,
    totalizer,
    availableCount: availableValues.length,
    rating: qscTotalRatingFromTotal(totalizer),
  };
}

function SemesterHistoryPanel({
  metrics,
  currentCompetence,
  updateFrequency = "Mensal",
}: {
  metrics: QscMetricSeries[];
  currentCompetence: string;
  updateFrequency?: string;
}) {
  const currentMonth = Number(currentCompetence.slice(5, 7)) || new Date().getMonth() + 1;
  const [selectedSemester, setSelectedSemester] = useState<1 | 2>(currentMonth <= 6 ? 1 : 2);
  const competencies = semesterCompetencies(currentCompetence, selectedSemester);
  const historyRows = SEMESTER_DOMAINS.map(({ domain, label }) => ({
    domain,
    label,
    ...qscHistoryRow(domain, metrics, competencies),
  }));
  const year = competencies[0]?.slice(0, 4);

  return (
    <Section
      title="Nota consolidada por semestre"
      description={`Soma mensal das notas de cada grupo no ${selectedSemester}º semestre de ${year}. O totalizador é a média das competências disponíveis; meses sem apuração aparecem como indisponíveis e não entram na média.`}
      actions={
        <div
          className="inline-flex rounded-md border border-border p-0.5"
          role="group"
          aria-label="Selecionar semestre do histórico QSC"
        >
          {([1, 2] as const).map((semester) => (
            <button
              key={semester}
              type="button"
              onClick={() => setSelectedSemester(semester)}
              aria-pressed={selectedSemester === semester}
              className={cn(
                "rounded-[4px] px-3 py-1.5 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                selectedSemester === semester
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {semester}º semestre
            </button>
          ))}
        </div>
      }
    >
      <TableScroll>
        <Table className="min-w-[1134px] table-fixed">
          <colgroup>
            <col className={STICKY_ID_WIDTH} />
            {competencies.map((competence) => (
              <col key={competence} className="w-[84px]" />
            ))}
            <col className="w-[112px]" />
            <col className="w-[92px]" />
            <col className="w-[140px]" />
            <col className="w-[164px]" />
          </colgroup>
          <TableHeader className={TABLE_HEADER_CLASS}>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(STICKY_ID_CLASS, "bg-muted")}>Grupo</TableHead>
              {competencies.map((competence) => (
                <TableHead key={competence} align="numeric">
                  {formatCompetence(competence).split("/")[0]}
                </TableHead>
              ))}
              <TableHead align="numeric">Totalizador</TableHead>
              <TableHead align="numeric">Pts</TableHead>
              <TableHead align="state">Faixa consolidada</TableHead>
              <TableHead>Periodicidade e base</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className={TABLE_BODY_CLASS}>
            {historyRows.map((row) => (
              <TableRow key={row.domain}>
                <TableCell className={cn(STICKY_ID_CLASS, "bg-card font-medium text-foreground")}>
                  {row.label}
                </TableCell>
                {row.values.map((value, index) => (
                  <TableCell key={competencies[index]} align="numeric">
                    {value === null ? (
                      <span className="text-muted-foreground">
                        —<span className="sr-only"> sem apuração</span>
                      </span>
                    ) : (
                      fmtInt(value)
                    )}
                  </TableCell>
                ))}
                <TableCell align="numeric" className="bg-muted/50 font-semibold text-foreground">
                  {fmtInt(row.totalizer)}
                </TableCell>
                <TableCell align="numeric" className="font-semibold text-foreground">
                  {fmtInt(row.rating?.points)}
                </TableCell>
                <TableCell align="state">
                  {row.rating ? (
                    <ConsolidatedBand band={row.rating.band} />
                  ) : (
                    <UnavailableTag state="missing" />
                  )}
                </TableCell>
                <TableCell className="!whitespace-normal text-xs leading-4 text-muted-foreground">
                  {updateFrequency} · {fmtInt(row.availableCount)} de {fmtInt(competencies.length)}{" "}
                  apuradas
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableScroll>
    </Section>
  );
}

/**
 * Faixa de indicadores críticos: mesmos números da tabela do grupo, agrupados por
 * relevância comercial. Sem card decorado, sem hover e com a mesma formatação
 * percentual das tabelas, para não sugerir uma segunda fonte de verdade.
 */
function PulseStrip({ metrics, competence }: { metrics: QscMetricSeries[]; competence: string }) {
  const pulseMetrics = PULSE_METRIC_IDS.flatMap((id) => {
    const metric = metrics.find((item) => item.id === id);
    return metric ? [metric] : [];
  });

  if (!pulseMetrics.length) return null;

  return (
    <section aria-labelledby="qsc-pulso">
      <h2 id="qsc-pulso" className="mb-2 text-[13px] font-semibold text-muted-foreground">
        Indicadores críticos · competência {formatCompetence(competence)}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {pulseMetrics.map((metric) => {
          const state = pointState(metric.latest);
          const available = state === "available";
          const maximumScore = maximumMetricScore(metric);

          return (
            <Card key={metric.id} className="p-3">
              <p className="min-h-8 text-xs font-medium leading-4 text-muted-foreground">
                {metric.label}
              </p>
              <div className="mt-1.5 flex items-baseline justify-between gap-2">
                <p className="text-2xl font-semibold leading-[30px] tabular-nums text-foreground">
                  {available ? fmtQscPct(metric.latest?.value) : "—"}
                </p>
                {available ? (
                  metric.latest?.scoreBand ? (
                    <IndicatorBand band={metric.latest.scoreBand} />
                  ) : (
                    <span className="text-xs text-muted-foreground">Sem faixa</span>
                  )
                ) : (
                  <UnavailableTag state={state} />
                )}
              </div>
              <dl className="mt-2.5 flex items-baseline justify-between gap-2 border-t border-border pt-2 text-xs text-muted-foreground">
                <div className="flex items-baseline gap-1">
                  <dt>Nota</dt>
                  <dd className="font-medium tabular-nums text-foreground">
                    {available ? scoreContent(metric.latest?.score, maximumScore) : "—"}
                  </dd>
                </div>
                <div className="flex items-baseline gap-1">
                  <dt className="sr-only">KPI1 e KPI2</dt>
                  <dd className="tabular-nums">
                    {available
                      ? `${fmtInt(metric.latest?.numerator)} / ${fmtInt(metric.latest?.denominator)}`
                      : "—"}
                  </dd>
                </div>
              </dl>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

function QscPage() {
  const { selected, role, allowedPartnerIds } = usePartnerFilter();
  const { data: partners = [] } = usePartners();
  const { data, isLoading, isFetching, error, refetch } = useQsc();

  const today = new Date();
  const calendarCompetence = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const currentCompetence = data?.competence ?? calendarCompetence;
  const hasCurrentCompetence = data?.available ?? false;
  const metrics = useMemo(() => data?.metrics ?? [], [data]);

  /**
   * Recorte em texto, sem alterar o filtro: nenhuma seleção continua significando
   * consolidado, e o GN sem seleção continua vendo apenas os parceiros vinculados.
   */
  const selectedNames = useMemo(
    () => selected.map((id) => partners.find((partner) => partner.id === id)?.name ?? id),
    [partners, selected],
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

  const metricsByDomain = (domain: QscDomain) =>
    metrics.filter((metric) => metric.domain === domain);
  const competenceIsBehind = hasCurrentCompetence && currentCompetence !== calendarCompetence;

  return (
    <DashboardLayout title="QSC">
      <header className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-[1.2] tracking-tight text-foreground md:text-[28px] md:leading-[34px]">
            QSC
          </h1>
          <dl className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <div className="flex min-w-0 items-baseline gap-1.5">
              <dt className="font-medium text-foreground">Recorte:</dt>
              <dd className="min-w-0 truncate">{scopeLabel}</dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="font-medium text-foreground">Competência:</dt>
              <dd>
                {formatCompetence(currentCompetence)}
                {competenceIsBehind && (
                  <span className="ml-1.5 text-xs">
                    (última apurada; mês corrente é {formatCompetence(calendarCompetence)})
                  </span>
                )}
              </dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="font-medium text-foreground">Atualização da base:</dt>
              <dd className="tabular-nums">{formatUpdatedAt(data?.calculatedAt)}</dd>
            </div>
            {data?.updateFrequency && (
              <div className="flex items-baseline gap-1.5">
                <dt className="font-medium text-foreground">Periodicidade:</dt>
                <dd>{data.updateFrequency}</dd>
              </div>
            )}
          </dl>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("size-4", isFetching && "animate-spin")} aria-hidden="true" />
            {isFetching ? "Atualizando" : "Atualizar"}
          </Button>
        </div>
      </header>

      {error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="space-y-6">
          <SectionSkeleton title="Nota consolidada por semestre" lines={3} />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5" aria-hidden="true">
            {PULSE_METRIC_IDS.map((id) => (
              <Skeleton key={id} className="h-[124px] w-full" />
            ))}
          </div>
          {(["carteira", "fixa", "movel"] as QscDomain[]).map((domain) => (
            <SectionSkeleton key={domain} title={DOMAIN_META[domain].label} lines={6} />
          ))}
        </div>
      ) : hasNoAuthorizedPartners ? (
        <EmptyState
          title="Nenhum parceiro autorizado"
          description="Seu perfil de GN ainda não possui vínculo com um parceiro. Procure o Diretor para liberar o recorte antes de consultar o QSC."
        />
      ) : !hasCurrentCompetence ? (
        <EmptyState
          title={`Sem base QSC para ${formatCompetence(currentCompetence)}`}
          description="A visão apresenta apenas a competência apurada. Peça a alimentação da base da competência para acompanhar os indicadores; nenhum valor provisório é exibido no lugar."
        />
      ) : (
        <div className="space-y-6">
          <SemesterHistoryPanel
            metrics={metrics}
            currentCompetence={currentCompetence}
            updateFrequency={data?.updateFrequency}
          />

          <PulseStrip metrics={metrics} competence={currentCompetence} />

          {(["carteira", "fixa", "movel"] as QscDomain[]).map((domain) => (
            <DomainPanel
              key={domain}
              domain={domain}
              metrics={metricsByDomain(domain)}
              competence={currentCompetence}
            />
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
