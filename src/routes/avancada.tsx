import { createFileRoute } from "@tanstack/react-router";
import { useMemo, type ReactNode } from "react";
import { Cpu, Percent, RefreshCw, Rocket } from "lucide-react";
import { ChartCard } from "@/components/ChartCard";
import { EmptyState, ErrorState } from "@/components/EmptyState";
import { KpiCard } from "@/components/KpiCard";
import { OpportunityFilterTooltip } from "@/components/OpportunityFilterTooltip";
import { OpportunitySimulator } from "@/components/OpportunitySimulator";
import { BarSimple, CategoryDistribution } from "@/components/charts";
import { Skeleton } from "@/components/ui/skeleton";
import { usePartnerFilter } from "@/contexts/AppContexts";
import { useAdvanced, usePartners } from "@/hooks/useData";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { fmtInt, fmtPct } from "@/lib/format";
import { ACTIVE_REVENUE_FILTER } from "@/lib/opportunity-filters";

export const Route = createFileRoute("/avancada")({
  head: () => ({ meta: [{ title: "Oportunidade Avançada — Mapa Parque" }] }),
  component: Page,
});

function Page() {
  const { data, isLoading, error, refetch } = useAdvanced();
  const { selected, role, allowedPartnerIds } = usePartnerFilter();
  const { data: partners = [] } = usePartners();

  const selectedNames = useMemo(
    () => selected.map((id) => partners.find((partner) => partner.id === id)?.name ?? id),
    [partners, selected],
  );
  const allowedCount = allowedPartnerIds?.length ?? 0;
  const scopeLabel = selected.length
    ? selected.length === 1
      ? selectedNames[0]
      : `${selected.length} parceiros selecionados`
    : role === "gn"
      ? `${allowedCount} ${allowedCount === 1 ? "parceiro autorizado" : "parceiros autorizados"}`
      : "Todos os parceiros (consolidado)";
  const partnerRows = data?.porParceiro ?? [];
  const comparison = data?.comparativo ?? [];

  return (
    <DashboardLayout title="Oportunidade Avançada">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold leading-[1.2] tracking-tight text-foreground md:text-[28px] md:leading-[34px]">
          Oportunidade Avançada
        </h1>
        <p className="mt-1.5 max-w-3xl text-sm leading-5 text-muted-foreground">
          Quantos CNPJs têm oportunidade de aquisição, winback, renovação e Vivo Tech no recorte, e
          o que esse potencial projeta em conversão, capacidade e receita.
        </p>
        <dl className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm text-muted-foreground">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <dt className="font-medium text-foreground">Recorte:</dt>
            <dd className="min-w-0 truncate" title={selectedNames.join(", ") || undefined}>
              {scopeLabel}
            </dd>
          </div>
          {!isLoading && !error && (
            <div className="flex items-baseline gap-1.5">
              <dt className="font-medium text-foreground">Parceiros no recorte:</dt>
              <dd className="tabular-nums">{fmtInt(partnerRows.length)}</dd>
            </div>
          )}
        </dl>
      </header>

      {error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <div className="space-y-6">
          <section aria-labelledby="avancada-oportunidade">
            <h2
              id="avancada-oportunidade"
              className="mb-2 text-[13px] font-semibold text-muted-foreground"
            >
              Portfólio especialista · CNPJs do Mapa Parque no recorte
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                icon={Rocket}
                title="Oportunidade Avançada"
                value={fmtInt(data?.kpis.acquisitionWinback)}
                tooltip={
                  <OpportunityFilterTooltip
                    groups={[
                      {
                        rules: [
                          ACTIVE_REVENUE_FILTER,
                          {
                            column: "AVANCADOS",
                            selection: 'contém "Aquisição", "Adesão" ou "Winback"',
                          },
                        ],
                      },
                    ]}
                  />
                }
                loading={isLoading}
                emphasis
              />
              <KpiCard
                icon={RefreshCw}
                title="Renovação de Avançada"
                value={fmtInt(data?.kpis.renewal)}
                tooltip={
                  <OpportunityFilterTooltip
                    groups={[
                      {
                        rules: [
                          ACTIVE_REVENUE_FILTER,
                          { column: "AVANCADOS", selection: 'contém "Renovação"' },
                        ],
                      },
                    ]}
                  />
                }
                loading={isLoading}
              />
              <KpiCard
                icon={Percent}
                title="% da base total"
                value={fmtPct(data?.kpis.percentualBase)}
                tooltip={
                  <OpportunityFilterTooltip
                    groups={[
                      {
                        title: "Numerador — Oportunidade Avançada",
                        rules: [
                          ACTIVE_REVENUE_FILTER,
                          {
                            column: "AVANCADOS",
                            selection: 'contém "Aquisição", "Adesão" ou "Winback"',
                          },
                        ],
                      },
                      { title: "Denominador — Base ativa", rules: [ACTIVE_REVENUE_FILTER] },
                    ]}
                  />
                }
                loading={isLoading}
              />
              <KpiCard
                icon={Cpu}
                title="Oportunidade Vivo Tech"
                value={fmtInt(data?.kpis.vivoTech)}
                tooltip={
                  <OpportunityFilterTooltip
                    groups={[
                      {
                        rules: [
                          ACTIVE_REVENUE_FILTER,
                          {
                            column: "VIVO_TECH",
                            selection: 'contém "Capacidade de Pagamento"',
                          },
                        ],
                      },
                    ]}
                  />
                }
                loading={isLoading}
              />
            </div>
          </section>

          <OpportunitySimulator
            rows={partnerRows.map((partner) => ({
              parceiro: partner.parceiro,
              oportunidades: partner.oportunidades,
            }))}
            storageKey="mapa-parque.advanced-simulators.v1"
            simulatorLabel="Simulador avançada"
            opportunityLabel="Oportunidade Avançada"
            quantityLabel="Soluções"
            revenueLabel="Receita avançada"
            loading={isLoading}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Oportunidade por parceiro"
              description={
                isLoading
                  ? "Distribuição por parceiro do recorte."
                  : `${fmtInt(partnerRows.length)} ${partnerRows.length === 1 ? "parceiro" : "parceiros"} no recorte, em CNPJs.`
              }
            >
              <DistributionBody
                loading={isLoading}
                empty={partnerRows.length === 0}
                emptyTitle="Sem parceiros no recorte"
                emptyDescription="Nenhum parceiro foi retornado para este recorte. Ajuste o filtro de parceiros ou verifique a disponibilidade da base."
              >
                <CategoryDistribution
                  data={partnerRows}
                  categoryKey="parceiro"
                  dataKey="oportunidades"
                />
              </DistributionBody>
            </ChartCard>
            <ChartCard
              title="Oportunidade Avançada x Renovação"
              description="Comparativo em CNPJs entre aquisição ou winback e renovação no mesmo recorte."
            >
              <DistributionBody
                loading={isLoading}
                empty={comparison.length === 0}
                emptyTitle="Sem comparativo disponível"
                emptyDescription="A base do Mapa Parque não retornou valores para aquisição, winback ou renovação neste recorte."
              >
                <BarSimple data={comparison} xKey="tipo" dataKey="valor" />
              </DistributionBody>
            </ChartCard>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function DistributionBody({
  loading,
  empty,
  emptyTitle,
  emptyDescription,
  children,
}: {
  loading: boolean;
  empty: boolean;
  emptyTitle: string;
  emptyDescription: string;
  children: ReactNode;
}) {
  if (loading) return <Skeleton className="h-[240px] w-full" aria-hidden="true" />;
  if (empty) return <EmptyState title={emptyTitle} description={emptyDescription} />;
  return <>{children}</>;
}
