import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Smartphone, Wifi } from "lucide-react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { usePartnerFilter } from "@/contexts/AppContexts";
import { usePartners } from "@/hooks/useData";
import { KpiCard } from "@/components/KpiCard";
import { OpportunityFilterTooltip } from "@/components/OpportunityFilterTooltip";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableScroll } from "@/components/TableScroll";
import { EmptyState, ErrorState } from "@/components/EmptyState";
import { fmtInt } from "@/lib/format";
import { ChartCard } from "@/components/ChartCard";
import { BarSimple } from "@/components/charts";
import { summarizeByDirectorate, summarizeByMonth, type InvasaoSnapshot } from "@/lib/invasao";

export const Route = createFileRoute("/invasao")({
  head: () => ({ meta: [{ title: "Invasão de Carteira — Mapa Parque" }] }),
  component: Page,
});

const labelMonth = (month: string) =>
  month
    ? new Date(`${month}-01T12:00:00Z`).toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      })
    : "—";

/** Rótulo curto do eixo do gráfico, ex.: "set/26". */
const shortMonth = (month: string) =>
  `${new Date(`${month}-01T12:00:00Z`)
    .toLocaleDateString("pt-BR", { month: "short", timeZone: "UTC" })
    .replace(".", "")}/${month.slice(2, 4)}`;

function Page() {
  const { effectiveSelected, selected, role, allowedPartnerIds } = usePartnerFilter();
  const { data: partnerList = [] } = usePartners();
  const [chosenMonth, setChosenMonth] = useState<string | null>(null);
  const { data, isPending, error, refetch } = useQuery<InvasaoSnapshot>({
    queryKey: ["invasao", effectiveSelected],
    queryFn: async () => {
      const params = new URLSearchParams();
      effectiveSelected.forEach((id) => params.append("partner", id));
      const response = await fetch(`/api/invasao?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível carregar a invasão de carteira.");
      return response.json();
    },
    enabled: role === "director" || role === "gn",
  });

  const months = useMemo(() => [...(data?.months ?? [])].reverse(), [data]);
  const month = chosenMonth && months.includes(chosenMonth) ? chosenMonth : (months[0] ?? "");
  const records = useMemo(
    () => (data?.records ?? []).filter((record) => record.month === month),
    [data, month],
  );
  const rows = useMemo(() => summarizeByDirectorate(records), [records]);
  const history = useMemo(() => summarizeByMonth(data?.records ?? [], data?.months ?? []), [data]);
  const totalMovel = rows.reduce((total, row) => total + row.altasMovel, 0);
  const totalFtth = rows.reduce((total, row) => total + row.altasFtth, 0);
  const partnersInMonth = new Set(
    (data?.periods ?? []).filter((period) => period.month === month).map((p) => p.partnerId),
  ).size;

  /** Recorte em texto, com a mesma semântica das demais páginas de oportunidade. */
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

  return (
    <DashboardLayout title="Invasão de Carteira">
      <header className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-[1.2] tracking-tight text-foreground md:text-[28px] md:leading-[34px]">
            Invasão de Carteira
          </h1>
          <p className="page-subtitle mt-1.5 max-w-3xl text-sm leading-5 text-muted-foreground">
            Altas Móvel e FTTH vendidas na carteira de outros parceiros, no mês de exercício e por
            Diretoria Habilitador.
          </p>
          <dl className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <div className="flex min-w-0 items-baseline gap-1.5">
              <dt className="font-medium text-foreground">Recorte:</dt>
              <dd className="min-w-0 truncate" title={selectedNames.join(", ") || undefined}>
                {scopeLabel}
              </dd>
            </div>
            {month && !isPending && !error && (
              <>
                <div className="flex items-baseline gap-1.5">
                  <dt className="font-medium text-foreground">Mês de exercício:</dt>
                  <dd className="capitalize">{labelMonth(month)}</dd>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <dt className="font-medium text-foreground">Parceiros na base do mês:</dt>
                  <dd className="tabular-nums">{fmtInt(partnersInMonth)}</dd>
                </div>
              </>
            )}
          </dl>
        </div>
        {months.length > 1 && (
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-sm font-medium text-foreground" id="invasao-mes">
              Mês
            </span>
            <Select value={month} onValueChange={setChosenMonth}>
              <SelectTrigger aria-labelledby="invasao-mes" className="w-48 capitalize">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((item) => (
                  <SelectItem key={item} value={item} className="capitalize">
                    {labelMonth(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </header>

      {error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : hasNoAuthorizedPartners ? (
        <EmptyState
          title="Nenhum parceiro autorizado"
          description="Seu perfil de GN ainda não possui vínculo com um parceiro. Procure o Diretor para liberar o recorte antes de consultar a invasão de carteira."
        />
      ) : !isPending && !month ? (
        <EmptyState
          title="Aguardando a base de invasão de carteira"
          description="A base com AnoMês, Grupo Rede Termo Carteira e Venda na Carteira ainda não foi importada para este recorte."
          action={
            <Button asChild variant="outline" size="sm" className="mt-1">
              <Link to="/alimentacao">Abrir Alimentar dados</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <section aria-labelledby="invasao-totais">
            <h2
              id="invasao-totais"
              className="mb-2 text-[13px] font-semibold text-muted-foreground"
            >
              Altas de invasão vendidas · quantidade de ativações no mês
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              <KpiCard
                icon={Smartphone}
                title="Altas Móvel"
                value={fmtInt(totalMovel)}
                tooltip={
                  <OpportunityFilterTooltip
                    groups={[
                      {
                        rules: [
                          { column: "Venda na Carteira", selection: 'selecione "Altas Invasão"' },
                          { column: "Tipo", selection: 'selecione "MOVEL"' },
                          { column: "Produto", selection: 'selecione "VOZ MOVEL"' },
                          { column: "Qtde. Ativação", selection: "soma da coluna" },
                        ],
                      },
                    ]}
                  />
                }
                loading={isPending}
                emphasis
              />
              <KpiCard
                icon={Wifi}
                title="Altas FTTH"
                value={fmtInt(totalFtth)}
                tooltip={
                  <OpportunityFilterTooltip
                    groups={[
                      {
                        rules: [
                          { column: "Venda na Carteira", selection: 'selecione "Altas Invasão"' },
                          { column: "Tipo", selection: 'selecione "FIXA BASICA"' },
                          { column: "Produto", selection: 'selecione "BANDA LARGA"' },
                          { column: "Qtde. Ativação", selection: "soma da coluna" },
                        ],
                      },
                    ]}
                  />
                }
                loading={isPending}
              />
            </div>
          </section>

          <Card className="overflow-hidden">
            <div className="border-b border-border px-4 py-3.5 md:px-5">
              <h2 className="text-[15px] font-semibold leading-[22px] text-foreground">
                Altas por Diretoria Habilitador
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Altas Móvel e Altas FTTH de invasão, separadas pela diretoria que habilitou a venda.
              </p>
            </div>
            <div className="px-4 py-4 md:px-5">
              {isPending ? (
                <Skeleton className="h-48 w-full" />
              ) : rows.length === 0 ? (
                <EmptyState
                  title="Sem altas de invasão no mês"
                  description="A base importada não tem altas de invasão de Móvel ou FTTH para este recorte e mês."
                />
              ) : (
                <TableScroll>
                  <Table className="min-w-[480px]">
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        <TableHead>Diretoria Habilitador</TableHead>
                        <TableHead align="numeric">Altas Móvel</TableHead>
                        <TableHead align="numeric">Altas FTTH</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.directorate}>
                          <TableCell className="font-medium text-foreground">
                            {row.directorate}
                          </TableCell>
                          <TableCell align="numeric">{fmtInt(row.altasMovel)}</TableCell>
                          <TableCell align="numeric">{fmtInt(row.altasFtth)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell className="font-semibold text-foreground">Total</TableCell>
                        <TableCell align="numeric" className="font-semibold text-foreground">
                          {fmtInt(totalMovel)}
                        </TableCell>
                        <TableCell align="numeric" className="font-semibold text-foreground">
                          {fmtInt(totalFtth)}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </TableScroll>
              )}
            </div>
          </Card>

          <section aria-labelledby="invasao-historico" className="space-y-3">
            <div>
              <h2
                id="invasao-historico"
                className="text-[15px] font-semibold leading-[22px] text-foreground"
              >
                Histórico de altas por mês
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Todos os meses da base no recorte, independente do mês escolhido acima. Só altas de
                invasão de Móvel e FTTH.
              </p>
            </div>
            {isPending ? (
              <Skeleton className="h-72 w-full" />
            ) : (
              <>
                <div className="grid gap-4 lg:grid-cols-2">
                  <ChartCard title="Altas Móvel por mês">
                    <BarSimple
                      data={history.map((item) => ({
                        mes: shortMonth(item.month),
                        altas: item.altasMovel,
                      }))}
                      xKey="mes"
                      dataKey="altas"
                      color="var(--chart-1)"
                    />
                  </ChartCard>
                  <ChartCard title="Altas FTTH por mês">
                    <BarSimple
                      data={history.map((item) => ({
                        mes: shortMonth(item.month),
                        altas: item.altasFtth,
                      }))}
                      xKey="mes"
                      dataKey="altas"
                      color="var(--chart-2)"
                    />
                  </ChartCard>
                </div>
                <Card className="overflow-hidden">
                  <div className="px-4 py-4 md:px-5">
                    <TableScroll>
                      <Table className="min-w-[480px]">
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>Mês</TableHead>
                            <TableHead align="numeric">Altas Móvel</TableHead>
                            <TableHead align="numeric">Altas FTTH</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...history].reverse().map((item) => (
                            <TableRow key={item.month}>
                              <TableCell className="font-medium capitalize text-foreground">
                                {labelMonth(item.month)}
                              </TableCell>
                              <TableCell align="numeric">{fmtInt(item.altasMovel)}</TableCell>
                              <TableCell align="numeric">{fmtInt(item.altasFtth)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow>
                            <TableCell className="font-semibold text-foreground">
                              Total no período
                            </TableCell>
                            <TableCell align="numeric" className="font-semibold text-foreground">
                              {fmtInt(history.reduce((total, item) => total + item.altasMovel, 0))}
                            </TableCell>
                            <TableCell align="numeric" className="font-semibold text-foreground">
                              {fmtInt(history.reduce((total, item) => total + item.altasFtth, 0))}
                            </TableCell>
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </TableScroll>
                  </div>
                </Card>
              </>
            )}
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}
