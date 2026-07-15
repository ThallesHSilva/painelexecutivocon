import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { KpiCard } from "@/components/KpiCard";
import { ChartCard } from "@/components/ChartCard";
import { BarSimple, DonutChart } from "@/components/charts";
import { ErrorState } from "@/components/EmptyState";
import { useLicenses } from "@/hooks/useData";
import { fmtInt, fmtBRLCompact, fmtPct } from "@/lib/format";
import { Users, UserCheck, Percent, Target, Coins, Boxes, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/licencas")({
  head: () => ({ meta: [{ title: "Licenças e Serviços Digitais — Mapa Parque" }] }),
  component: Page,
});

function Page() {
  const { data, isLoading, error, refetch } = useLicenses();

  return (
    <DashboardLayout title="Licenças e Serviços Digitais">
      {error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            <KpiCard icon={Users} title="Base elegível" value={fmtInt(data?.kpis.baseElegivel)} tooltip="População base calculada pelo backend com regras de elegibilidade." loading={isLoading} />
            <KpiCard icon={UserCheck} title="Clientes elegíveis" value={fmtInt(data?.kpis.clientesElegiveis)} tooltip="Clientes aptos a receber ofertas digitais." loading={isLoading} />
            <KpiCard icon={Percent} title="% da base elegível" value={fmtPct(data?.kpis.percentualBase)} loading={isLoading} />
            <KpiCard icon={Target} title="Potencial de adoção" value={fmtInt(data?.kpis.potencialAdocao)} tooltip="Estimativa de adoção calculada pelo backend." loading={isLoading} />
            <KpiCard icon={Coins} title="Cenário R$ 34" value={fmtBRLCompact(data?.kpis.cenario34)} description="Ticket conservador, ano" loading={isLoading} />
            <KpiCard icon={Coins} title="Cenário R$ 100" value={fmtBRLCompact(data?.kpis.cenario100)} description="Ticket otimista, ano" loading={isLoading} emphasis />
            <KpiCard icon={TrendingUp} title="Oportunidade total estimada" value={fmtBRLCompact(data?.kpis.totalEstimado)} description="Cenário médio, ano" loading={isLoading} />
            <KpiCard icon={Boxes} title="Tipos de oferta" value={data ? String(data.composicao.length) : "—"} loading={isLoading} />
          </div>

          <p className="mt-4 text-[11px] text-muted-foreground">
            População utilizada em cada indicador é definida pelo backend. Percentuais, tickets e regras são
            calculados no processamento e apenas exibidos aqui.
          </p>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ChartCard title="Base elegível por parceiro" description="Ordem alfabética.">
              {data && <BarSimple data={data.porParceiro} xKey="parceiro" dataKey="baseElegivel" />}
            </ChartCard>
            <ChartCard title="Composição das oportunidades digitais">
              {data && <DonutChart data={data.composicao} nameKey="tipo" dataKey="valor" />}
            </ChartCard>
            <ChartCard title="Potencial financeiro por cenário">
              {data && <BarSimple data={data.potencial} xKey="cenario" dataKey="valor" color="var(--chart-2)" />}
            </ChartCard>
            <ChartCard title="Distribuição por tipo de oferta">
              {data && <BarSimple data={data.composicao} xKey="tipo" dataKey="valor" color="var(--chart-3)" />}
            </ChartCard>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
