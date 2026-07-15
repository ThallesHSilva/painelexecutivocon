import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { KpiCard } from "@/components/KpiCard";
import { ChartCard } from "@/components/ChartCard";
import { BarSimple, BarStacked } from "@/components/charts";
import { ErrorState } from "@/components/EmptyState";
import { useCapacity } from "@/hooks/useData";
import { fmtInt } from "@/lib/format";
import { PhoneCall, Target, Users, Calendar, CalendarDays, CalendarClock, UserCheck, Headset, GaugeCircle, AlertTriangle } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/capacidade")({
  head: () => ({ meta: [{ title: "Capacidade Comercial — Mapa Parque" }] }),
  component: Page,
});

function Page() {
  const { data, isLoading, error, refetch } = useCapacity();
  const gap = data?.kpis.gap ?? 0;

  return (
    <DashboardLayout title="Capacidade Comercial">
      {error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            <KpiCard icon={PhoneCall} title="Linhas potenciais" value={fmtInt(data?.kpis.linhasPotenciais)} loading={isLoading} />
            <KpiCard icon={Target} title="Meta estimada" value={fmtInt(data?.kpis.metaEstimada)} loading={isLoading} emphasis />
            <KpiCard icon={Users} title="PDU" value={fmtInt(data?.kpis.pdu)} tooltip="Pessoas de vendas necessárias segundo backend." loading={isLoading} />
            <KpiCard icon={Calendar} title="Alimentação mensal" value={fmtInt(data?.kpis.alimMensal)} loading={isLoading} />
            <KpiCard icon={CalendarDays} title="Alimentação semanal" value={fmtInt(data?.kpis.alimSemanal)} loading={isLoading} />
            <KpiCard icon={CalendarClock} title="Alimentação diária" value={fmtInt(data?.kpis.alimDiario)} loading={isLoading} />
            <KpiCard icon={UserCheck} title="Qualificados mensais" value={fmtInt(data?.kpis.qualifMensal)} loading={isLoading} />
            <KpiCard icon={UserCheck} title="Qualificados semanais" value={fmtInt(data?.kpis.qualifSemanal)} loading={isLoading} />
            <KpiCard icon={UserCheck} title="Qualificados diários" value={fmtInt(data?.kpis.qualifDiario)} loading={isLoading} />
            <KpiCard icon={Headset} title="CX necessário" value={fmtInt(data?.kpis.cxNecessario)} loading={isLoading} />
            <KpiCard icon={GaugeCircle} title="Capacidade disponível" value={fmtInt(data?.kpis.capacidadeDisponivel)} loading={isLoading} />
            <KpiCard icon={AlertTriangle} title="Gap de capacidade" value={fmtInt(data?.kpis.gap)} description={gap > 0 ? "Atenção: gap identificado" : "Sem gap"} loading={isLoading} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <ChartCard title="Volume mensal, semanal e diário" description="Alimentação e qualificados.">
              {data && (
                <BarStacked
                  data={data.volume}
                  xKey="periodo"
                  keys={[
                    { key: "alimentacao", label: "Alimentação" },
                    { key: "qualificados", label: "Qualificados" },
                  ]}
                />
              )}
            </ChartCard>
            <ChartCard title="Capacidade necessária versus disponível">
              {data && <BarSimple data={data.capacidade} xKey="nome" dataKey="valor" color="var(--chart-2)" />}
            </ChartCard>
          </div>

          <Card className="mt-6 overflow-hidden rounded-2xl border shadow-elegant">
            <div className="flex items-center justify-between border-b p-5">
              <div>
                <h3 className="text-sm font-semibold tracking-tight">Resumo por parceiro</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Ordem alfabética.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parceiro</TableHead>
                    <TableHead className="text-right">Linhas</TableHead>
                    <TableHead className="text-right">Meta</TableHead>
                    <TableHead className="text-right">CX necessário</TableHead>
                    <TableHead className="text-right">CX disponível</TableHead>
                    <TableHead className="text-right">Gap</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.porParceiro.map((r) => (
                    <TableRow key={r.parceiro}>
                      <TableCell className="font-medium">{r.parceiro}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtInt(r.linhas)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtInt(r.meta)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtInt(r.cxNecessario)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtInt(r.cxDisponivel)}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.gap > 0 ? (
                          <Badge className="bg-warning/15 text-warning hover:bg-warning/20">{fmtInt(r.gap)}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </DashboardLayout>
  );
}
