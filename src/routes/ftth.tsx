import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { KpiCard } from "@/components/KpiCard";
import { OpportunityFilterTooltip } from "@/components/OpportunityFilterTooltip";
import { ACTIVE_REVENUE_FILTER } from "@/lib/opportunity-filters";
import { ChartCard } from "@/components/ChartCard";
import { BarRanked, CategoryDistribution } from "@/components/charts";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/EmptyState";
import { useFtth, usePartners } from "@/hooks/useData";
import { fmtInt, fmtPct } from "@/lib/format";
import { MapPin, Signal } from "lucide-react";
import { OpportunitySimulator } from "@/components/OpportunitySimulator";
import { usePartnerFilter } from "@/contexts/AppContexts";

export const Route = createFileRoute("/ftth")({
  head: () => ({ meta: [{ title: "Oportunidades FTTH — Mapa Parque" }] }),
  component: Page,
});

/** Recorte inicial do gráfico de cidades; a lista completa continua acessível no próprio card. */
const CITY_PREVIEW = 12;

function Page() {
  const { data, isLoading, error, refetch } = useFtth();
  const { selected, role, allowedPartnerIds } = usePartnerFilter();
  const { data: partners = [] } = usePartners();
  const [allCities, setAllCities] = useState(false);

  /**
   * Recorte em texto, com a mesma semântica da Visão resultado: nenhuma seleção
   * continua significando o consolidado dos parceiros permitidos ao perfil.
   */
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

  const cities = useMemo(
    () =>
      [...(data?.geo ?? [])].sort(
        (left, right) => (Number(right.oportunidades) || 0) - (Number(left.oportunidades) || 0),
      ),
    [data],
  );
  const visibleCities = allCities ? cities : cities.slice(0, CITY_PREVIEW);
  const partnerRows = data?.porParceiro ?? [];

  return (
    <DashboardLayout title="Oportunidades FTTH">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold leading-[1.2] tracking-tight text-foreground md:text-[28px] md:leading-[34px]">
          Oportunidades FTTH
        </h1>
        <p className="page-subtitle mt-1.5 max-w-3xl text-sm leading-5 text-muted-foreground">
          Quanta oportunidade de fixa básica existe no recorte, onde ela está e o que ela projeta em
          conversão, capacidade e receita.
        </p>
        <dl className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm text-muted-foreground">
          <div className="flex min-w-0 items-baseline gap-1.5">
            <dt className="font-medium text-foreground">Recorte:</dt>
            <dd className="min-w-0 truncate" title={selectedNames.join(", ") || undefined}>
              {scopeLabel}
            </dd>
          </div>
          {!isLoading && !error && (
            <>
              <div className="flex items-baseline gap-1.5">
                <dt className="font-medium text-foreground">Parceiros no recorte:</dt>
                <dd className="tabular-nums">{fmtInt(partnerRows.length)}</dd>
              </div>
              <div className="flex items-baseline gap-1.5">
                <dt className="font-medium text-foreground">Cidades com oportunidade:</dt>
                <dd className="tabular-nums">{fmtInt(cities.length)}</dd>
              </div>
            </>
          )}
        </dl>
      </header>

      {error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <div className="space-y-6">
          <section aria-labelledby="ftth-oportunidade">
            <h2
              id="ftth-oportunidade"
              className="mb-2 text-[13px] font-semibold text-muted-foreground"
            >
              Oportunidade de fixa básica · CNPJs do Mapa Parque no recorte
            </h2>
            <div className="grid gap-3 md:grid-cols-2">
              <KpiCard
                icon={MapPin}
                title="Aquisição Fixa Básica"
                value={fmtInt(data?.kpis.oportunidades)}
                tooltip={
                  <OpportunityFilterTooltip
                    groups={[
                      {
                        rules: [
                          ACTIVE_REVENUE_FILTER,
                          {
                            column: "FIXA_BASICA",
                            selection:
                              'contém "Aquisição" ou "Adesão" e contém "Capacidade de Pagamento"',
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
                icon={Signal}
                title="Penetração na base"
                value={fmtPct(data?.kpis.penetracaoBase)}
                description="Base Fixa Básica sobre base mais oportunidade."
                tooltip={
                  <OpportunityFilterTooltip
                    groups={[
                      {
                        title: "Base Fixa Básica",
                        rules: [
                          ACTIVE_REVENUE_FILTER,
                          { column: "TP_PRODUTO", selection: 'contém "BASICA"' },
                        ],
                      },
                      {
                        title: "Oportunidade Fixa Básica",
                        rules: [
                          ACTIVE_REVENUE_FILTER,
                          {
                            column: "FIXA_BASICA",
                            selection:
                              'contém "Aquisição" ou "Adesão" e contém "Capacidade de Pagamento"',
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
            storageKey="mapa-parque.ftth-simulators.v1"
            simulatorLabel="Simulador FTTH"
            opportunityLabel="Aquisição Fixa Básica"
            quantityLabel="BLs"
            revenueLabel="Receita FTTH"
            loading={isLoading}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Oportunidade por cidade"
              description={
                isLoading
                  ? "Distribuição por cidade do recorte."
                  : cities.length > CITY_PREVIEW && !allCities
                    ? `${CITY_PREVIEW} cidades com maior oportunidade, de ${fmtInt(cities.length)}. Valores em CNPJs.`
                    : `${fmtInt(cities.length)} ${cities.length === 1 ? "cidade" : "cidades"} com oportunidade. Valores em CNPJs.`
              }
            >
              <DistributionBody
                loading={isLoading}
                empty={cities.length === 0}
                emptyTitle="Sem base de cidades"
                emptyDescription="A base do Mapa Parque não retornou cidades com oportunidade para este recorte."
              >
                <BarRanked data={visibleCities} categoryKey="cidade" dataKey="oportunidades" />
                {cities.length > CITY_PREVIEW && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAllCities((current) => !current)}
                    aria-expanded={allCities}
                    className="mt-2 w-full text-primary"
                  >
                    {allCities
                      ? "Mostrar apenas as principais"
                      : `Ver todas as ${cities.length} cidades`}
                  </Button>
                )}
              </DistributionBody>
            </ChartCard>
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
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

/**
 * Base em carregamento, base indisponível e resultado zero são estados distintos:
 * enquanto a consulta não responde, nada é apresentado como zero; um recorte sem
 * linhas mostra a ausência em texto, não um gráfico vazio.
 */
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
