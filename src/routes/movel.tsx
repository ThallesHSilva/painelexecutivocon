import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { KpiCard } from "@/components/KpiCard";
import { ChartCard } from "@/components/ChartCard";
import { BarSimple, DonutChart } from "@/components/charts";
import { ErrorState } from "@/components/EmptyState";
import { useMobile } from "@/hooks/useData";
import { fmtInt } from "@/lib/format";
import { Smartphone, Users, PhoneCall, Target, Calendar, CalendarDays, CalendarClock, UserCheck, ClipboardList, Headset } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/movel")({
  head: () => ({ meta: [{ title: "Oportunidades Móvel — Mapa Parque" }] }),
  component: Page,
});

function Page() {
  const { data, isLoading, error, refetch } = useMobile();

  return (
    <DashboardLayout title="Oportunidades Móvel">
      {error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <KpiCard icon={Users} title="Base REC_MOVEL" value={fmtInt(data?.kpis.baseRecMovel)} tooltip="Base ativa em REC_MOVEL considerada pelo backend." loading={isLoading} />
            <KpiCard icon={UserCheck} title="Clientes elegíveis" value={fmtInt(data?.kpis.elegiveis)} tooltip="Clientes com elegibilidade comercial ativa." loading={isLoading} />
            <KpiCard icon={PhoneCall} title="Linhas potenciais" value={fmtInt(data?.kpis.linhasPotenciais)} tooltip="Estimativa de linhas potenciais." loading={isLoading} emphasis />
            <KpiCard icon={Target} title="Meta de conversão" value={fmtInt(data?.kpis.metaConversao)} tooltip="Meta estimada pelo backend com base histórica." loading={isLoading} />
            <KpiCard icon={Smartphone} title="Oportunidade mensal" value={fmtInt(data?.kpis.oportMensal)} tooltip="Volume mensal a ser trabalhado." loading={isLoading} />
            <KpiCard icon={Calendar} title="Oportunidade semanal" value={fmtInt(data?.kpis.oportSemanal)} loading={isLoading} />
            <KpiCard icon={CalendarDays} title="Oportunidade diária" value={fmtInt(data?.kpis.oportDiario)} loading={isLoading} />
            <KpiCard icon={UserCheck} title="Contatos qualificados" value={fmtInt(data?.kpis.contatosQualificados)} loading={isLoading} />
            <KpiCard icon={ClipboardList} title="Alimentação comercial" value={fmtInt(data?.kpis.alimentacaoComercial)} tooltip="Volume necessário para alimentar as operações comerciais." loading={isLoading} />
            <KpiCard icon={Headset} title="CX necessário" value={fmtInt(data?.kpis.cxNecessario)} loading={isLoading} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <ChartCard title="Composição das oportunidades móveis" description="Por tipo de oportunidade classificada.">
              {data && <DonutChart data={data.composicao} nameKey="tipo" dataKey="valor" />}
            </ChartCard>
            <ChartCard title="Linhas potenciais por parceiro" description="Ordem alfabética.">
              {data && <BarSimple data={data.porParceiro} xKey="parceiro" dataKey="linhas" />}
            </ChartCard>
            <ChartCard title="Volume mensal, semanal e diário" description="Distribuição da oportunidade no tempo.">
              {data && <BarSimple data={data.volume} xKey="periodo" dataKey="valor" color="var(--chart-2)" />}
            </ChartCard>
            <ChartCard title="Necessidade de CX por parceiro" description="Capacidade estimada pelo backend.">
              {data && <BarSimple data={data.porParceiro} xKey="parceiro" dataKey="cx" color="var(--chart-3)" />}
            </ChartCard>
          </div>

          <Card className="mt-6 overflow-hidden rounded-2xl border shadow-elegant">
            <div className="border-b p-5">
              <h3 className="text-sm font-semibold tracking-tight">Resumo por parceiro</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Ordem alfabética. Sem ranking competitivo.</p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parceiro</TableHead>
                    <TableHead className="text-right">Elegíveis</TableHead>
                    <TableHead className="text-right">Linhas potenciais</TableHead>
                    <TableHead className="text-right">CX necessário</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.porParceiro.map((r) => (
                    <TableRow key={r.parceiro}>
                      <TableCell className="font-medium">{r.parceiro}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtInt(r.elegiveis)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtInt(r.linhas)}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtInt(r.cx)}</TableCell>
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
