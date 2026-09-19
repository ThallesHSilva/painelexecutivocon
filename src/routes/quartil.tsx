import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, Minus, Users, ChevronDown, Search } from "lucide-react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { usePartnerFilter } from "@/contexts/AppContexts";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { QuartilMetric, QuartilSnapshot } from "@/lib/quartil";

export const Route = createFileRoute("/quartil")({
  head: () => ({ meta: [{ title: "Quartil — Mapa Parque" }] }),
  component: QuartilPage,
});
const metrics: { id: QuartilMetric; label: string }[] = [
  { id: "receita", label: "Receita" },
  { id: "movel", label: "Móvel" },
  { id: "ftth", label: "FTTH" },
];
const colors = ["bg-emerald-500", "bg-teal-500", "bg-amber-400", "bg-orange-500", "bg-rose-500"];
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
  const rows = consultants
    .filter((c) =>
      `${c.name} ${c.partnerName}`
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .includes(normalizedSearch),
    )
    .sort((a, b) => a.name.localeCompare(b.name));
  const actualPage = Math.min(page, Math.max(0, Math.ceil(rows.length / 20) - 1));
  const shown = rows.slice(actualPage * 20, actualPage * 20 + 20);
  return (
    <DashboardLayout title="Quartil">
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">
              Desempenho dos consultores
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Quartil</h1>
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
              <Card className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-muted-foreground">Consultores atuais</p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums">
                    {number(consultants.length)}
                  </p>
                </div>
                <Users className="size-7 text-primary/70" />
              </Card>
              {metrics.map((m) => (
                <Card key={m.id} className="p-5">
                  <p className="text-sm text-muted-foreground">{m.label} · Quartil 1</p>
                  <p className="mt-2 text-3xl font-semibold tabular-nums">
                    {consultants.filter((c) => c.quartiles[m.id] === 1).length}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      consultores
                    </span>
                  </p>
                </Card>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div
                className="inline-flex rounded-xl border bg-muted/40 p-1"
                aria-label="Indicador do quartil"
              >
                {metrics.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMetric(m.id)}
                    aria-pressed={metric === m.id}
                    className={`rounded-lg px-5 py-2 text-sm font-medium transition ${metric === m.id ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Q1 é o melhor desempenho · classificação por tempo de casa
              </p>
            </div>
            <Card className="overflow-hidden">
              <div className="border-b px-5 py-4">
                <h2 className="font-semibold">Distribuição por parceiro</h2>
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
                  <Card key={period} className="p-5">
                    <div className="flex items-center justify-between">
                      <h2 className="font-semibold">Evolução em {period} meses</h2>
                      <span className="text-xs text-muted-foreground">
                        {before ? `${labelMonth(before)} → ${labelMonth(data.latestMonth)}` : "—"}
                      </span>
                    </div>
                    <div className="mt-5 grid grid-cols-4 gap-2">
                      {[
                        {
                          label: "Evoluíram",
                          count: changes.filter((v) => v !== null && v > 0).length,
                          color: "text-emerald-600",
                        },
                        {
                          label: "Regrediram",
                          count: changes.filter((v) => v !== null && v < 0).length,
                          color: "text-rose-600",
                        },
                        {
                          label: "Estáveis",
                          count: changes.filter((v) => v === 0).length,
                          color: "text-foreground",
                        },
                        {
                          label: "Sem histórico",
                          count: changes.filter((v) => v === null).length,
                          color: "text-muted-foreground",
                        },
                      ].map((item) => (
                        <div key={item.label}>
                          <p className={`text-2xl font-semibold tabular-nums ${item.color}`}>
                            {item.count}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">{item.label}</p>
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
                <h2 className="font-semibold">Consultores e trajetória</h2>
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
                        metric={metric}
                        months={data.months.slice(-7)}
                        expanded={expanded === c.id}
                        onToggle={() => setExpanded(expanded === c.id ? null : c.id)}
                      />
                    ))}
                  </tbody>
                </table>
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
                    className="disabled:opacity-30"
                  >
                    Anterior
                  </button>
                  <button
                    disabled={(actualPage + 1) * 20 >= rows.length}
                    onClick={() => setPage(actualPage + 1)}
                    className="disabled:opacity-30"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            </Card>
            <details className="rounded-2xl border bg-card p-5">
              <summary className="cursor-pointer text-sm font-semibold">
                Regras de classificação e acompanhamento
              </summary>
              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                <p>
                  Somente consultores presentes em {labelMonth(data.latestMonth)}. Identificação
                  pelo nome normalizado e parceiro. Ausência em meses anteriores não equivale a
                  produção zero. A evolução compara o quartil atual com o de 3 e 6 meses atrás,
                  usando o tempo de casa de cada mês.
                </p>
                <p>
                  Receita utiliza RECEITA TELECOM TT; Móvel utiliza FISICOS MÓVEL; FTTH utiliza
                  FISICOS FTTH. M de CASA define acima/abaixo de 3 meses; na ausência, tempo de casa
                  acima de 90 dias define o grupo experiente.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] text-xs">
                    <thead>
                      <tr>
                        {["Tempo de casa / indicador", "Q1", "Q2", "Q3", "Q4", "Q5"].map((h) => (
                          <th key={h} className="p-2 text-left">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        [
                          "Acima de 3 meses · Receita",
                          "≥ R$ 2.000",
                          "≥ 1.500 e < 2.000",
                          "≥ 1.000 e < 1.500",
                          "≥ 500 e < 1.000",
                          "< R$ 500",
                        ],
                        [
                          "Acima de 3 meses · Móvel",
                          "≥ 21",
                          "16 a 20",
                          "11 a 15",
                          "6 a 10",
                          "0 a 5",
                        ],
                        ["Acima de 3 meses · FTTH", "≥ 15", "10 a 14", "6 a 9", "3 a 5", "0 a 2"],
                        [
                          "Até 3 meses · Receita",
                          "≥ R$ 500",
                          "≥ 251 e < 500",
                          "≥ 100 e < 251",
                          "> 0 e < 100",
                          "Zero",
                        ],
                        ["Até 3 meses · Móvel", "≥ 16", "11 a 15", "6 a 10", "1 a 5", "Zero"],
                        ["Até 3 meses · FTTH", "≥ 10", "6 a 9", "3 a 5", "1 a 2", "Zero"],
                      ].map((r) => (
                        <tr key={r[0]} className="border-t">
                          {r.map((v, i) => (
                            <td key={i} className="p-2">
                              {v}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </details>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

function ConsultantRows({
  consultant: c,
  metric,
  months,
  expanded,
  onToggle,
}: {
  consultant: import("@/lib/quartil").QuartilConsultant;
  metric: QuartilMetric;
  months: string[];
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="border-t border-border/50 hover:bg-muted/20">
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
          <td colSpan={8} className="bg-primary/[0.025] px-6 py-5">
            <table className="w-full text-xs">
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
                            {point?.values[m.id] != null ? number(point.values[m.id]!) : "Sem dado"}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}
