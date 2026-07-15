import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { KpiCard } from "@/components/KpiCard";
import { ChartCard } from "@/components/ChartCard";
import { BarSimple, BarStacked, DonutChart } from "@/components/charts";
import { ErrorState } from "@/components/EmptyState";
import { useFtth } from "@/hooks/useData";
import { fmtInt, fmtBRLCompact } from "@/lib/format";
import { Wifi, MapPin, RefreshCw, Combine, Signal, Coins } from "lucide-react";

export const Route = createFileRoute("/ftth")({
  head: () => ({ meta: [{ title: "Oportunidades FTTH — Mapa Parque" }] }),
  component: Page,
});

function Page() {
  const { data, isLoading, error, refetch } = useFtth();

  return (
    <DashboardLayout title="Oportunidades FTTH">
      {error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiCard icon={MapPin} title="Clientes com cobertura" value={fmtInt(data?.kpis.cobertura)} tooltip="Clientes cujo endereço tem cobertura FTTH ativa." loading={isLoading} />
            <KpiCard icon={Wifi} title="Clientes elegíveis" value={fmtInt(data?.kpis.elegiveis)} loading={isLoading} emphasis />
            <KpiCard icon={RefreshCw} title="Renovação" value={fmtInt(data?.kpis.renovacao)} tooltip="Oportunidades de renovação de contrato FTTH." loading={isLoading} />
            <KpiCard icon={Combine} title="Convergentes" value={fmtInt(data?.kpis.convergentes)} tooltip="Oportunidades convergentes entre móvel e FTTH." loading={isLoading} />
            <KpiCard icon={Signal} title="Móvel + FTTH" value={fmtInt(data?.kpis.movelMaisFtth)} loading={isLoading} />
            <KpiCard icon={Coins} title="Potencial estimado" value={fmtBRLCompact(data?.kpis.potencial)} loading={isLoading} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <ChartCard title="Composição das oportunidades FTTH" description="Distribuição por tipo de oportunidade.">
              {data && <DonutChart data={data.composicao} nameKey="tipo" dataKey="valor" />}
            </ChartCard>
            <ChartCard title="Cobertura versus oportunidade por UF">
              {data && (
                <BarStacked
                  data={data.geo}
                  xKey="uf"
                  keys={[
                    { key: "cobertura", label: "Cobertura" },
                    { key: "oportunidade", label: "Oportunidade" },
                  ]}
                />
              )}
            </ChartCard>
            <ChartCard title="Cobertura versus oportunidade">
              {data && <BarSimple data={data.coberturaVsOport} xKey="grupo" dataKey="valor" color="var(--chart-3)" />}
            </ChartCard>
            <ChartCard title="Distribuição por parceiro" description="Ordem alfabética.">
              {data && (
                <BarStacked
                  data={data.porParceiro}
                  xKey="parceiro"
                  keys={[
                    { key: "cobertura", label: "Cobertura" },
                    { key: "oportunidade", label: "Oportunidade" },
                  ]}
                />
              )}
            </ChartCard>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
