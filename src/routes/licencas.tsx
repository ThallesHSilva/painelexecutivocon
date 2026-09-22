import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { KpiCard } from "@/components/KpiCard";
import { OpportunityFilterTooltip } from "@/components/OpportunityFilterTooltip";
import { ACTIVE_REVENUE_FILTER } from "@/lib/opportunity-filters";
import { ChartCard } from "@/components/ChartCard";
import { BarSimple, CategoryDistribution } from "@/components/charts";
import { EmptyState, ErrorState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useLicenses, usePartners } from "@/hooks/useData";
import { fmtInt, fmtBRLCompact } from "@/lib/format";
import { CloudCog, ShieldCheck, UserCheck } from "lucide-react";
import { OpportunitySimulator } from "@/components/OpportunitySimulator";
import { usePartnerFilter } from "@/contexts/AppContexts";

export const Route = createFileRoute("/licencas")({
  head: () => ({ meta: [{ title: "Licenças e Serviços Digitais — Mapa Parque" }] }),
  component: Page,
});

function Page() {
  const { data, isLoading, error, refetch } = useLicenses();
  const { selected, role, allowedPartnerIds } = usePartnerFilter();
  const { data: partners = [] } = usePartners();
  const [conversionRate, setConversionRate] = useState(34);
  const appliedRate = Math.min(100, Math.max(0, conversionRate));

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

  /**
   * Cenários financeiros: mesma adoção potencial e mesmos tickets de antes. Sem base
   * carregada não há adoção a projetar — antes a ausência virava zero por `?? 0` e o
   * gráfico apresentava três barras zeradas como se fossem resultado.
   */
  const eligible = data?.kpis.clientesElegiveis;
  const potentialAdoption =
    eligible == null || !Number.isFinite(eligible)
      ? null
      : Math.round(eligible * (appliedRate / 100));
  const financialScenarios =
    potentialAdoption == null
      ? []
      : [
          { cenario: "Conservador (R$34)", valor: potentialAdoption * 34 },
          { cenario: "Médio (R$62)", valor: potentialAdoption * 62 },
          { cenario: "Otimista (R$100)", valor: potentialAdoption * 100 },
        ];

  const partnerRows = data?.porParceiro ?? [];
  const composition = data?.composicao ?? [];

  return (
    <DashboardLayout title="Licenças e Serviços Digitais">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold leading-[1.2] tracking-tight text-foreground md:text-[28px] md:leading-[34px]">
          Licenças e Serviços Digitais
        </h1>
        <p className="page-subtitle mt-1.5 max-w-3xl text-sm leading-5 text-muted-foreground">
          Quantos clientes do recorte estão elegíveis a TI Recorrente e quanto essa adesão projeta
          em conversão e receita.
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
                <dt className="font-medium text-foreground">Tipos de oferta:</dt>
                <dd className="tabular-nums">{fmtInt(composition.length)}</dd>
              </div>
            </>
          )}
        </dl>
      </header>

      {error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <div className="space-y-6">
          <section aria-labelledby="licencas-oportunidade">
            <h2
              id="licencas-oportunidade"
              className="mb-2 text-[13px] font-semibold text-muted-foreground"
            >
              Oportunidade de TI Recorrente · CNPJs do Mapa Parque no recorte
            </h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                icon={UserCheck}
                title="Oportunidades TI Recorrente"
                value={fmtInt(data?.kpis.clientesElegiveis)}
                tooltip={
                  <OpportunityFilterTooltip
                    groups={[
                      {
                        title: "Filtro comum aos três públicos",
                        rules: [ACTIVE_REVENUE_FILTER],
                      },
                      {
                        title: "1. Cross Segurança em Dados",
                        rules: [
                          {
                            column: "QT_AVANCADA_DADOS",
                            selection: "valor numérico maior que 0",
                          },
                        ],
                      },
                      {
                        title: "2. Google com pré-aprovação",
                        rules: [
                          {
                            column: "DIGITAL_1",
                            selection: 'contém "Capacidade" e contém "Google"',
                          },
                        ],
                      },
                      {
                        title: "3. Microsoft 365 com pré-aprovação",
                        rules: [
                          {
                            column: "DIGITAL_1",
                            selection: 'contém "Capacidade" e contém "Microsoft 365"',
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
                icon={ShieldCheck}
                title="Cross Segurança em Dados"
                value={fmtInt(data?.kpis.segurancaEmDados)}
                tooltip={
                  <OpportunityFilterTooltip
                    groups={[
                      {
                        rules: [
                          ACTIVE_REVENUE_FILTER,
                          {
                            column: "QT_AVANCADA_DADOS",
                            selection: "valor numérico maior que 0",
                          },
                        ],
                      },
                    ]}
                  />
                }
                loading={isLoading}
              />
              <KpiCard
                icon={CloudCog}
                title="Google com pré-aprovação"
                value={fmtInt(data?.kpis.googleComCredito)}
                tooltip={
                  <OpportunityFilterTooltip
                    groups={[
                      {
                        rules: [
                          ACTIVE_REVENUE_FILTER,
                          {
                            column: "DIGITAL_1",
                            selection: 'contém "Capacidade" e contém "Google"',
                          },
                        ],
                      },
                    ]}
                  />
                }
                loading={isLoading}
              />
              <KpiCard
                icon={CloudCog}
                title="Microsoft 365 com pré-aprovação"
                value={fmtInt(data?.kpis.microsoft365ComCredito)}
                tooltip={
                  <OpportunityFilterTooltip
                    groups={[
                      {
                        rules: [
                          ACTIVE_REVENUE_FILTER,
                          {
                            column: "DIGITAL_1",
                            selection: 'contém "Capacidade" e contém "Microsoft 365"',
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
              oportunidades: partner.elegiveis,
            }))}
            storageKey="mapa-parque.digital-simulators.v1"
            simulatorLabel="Simulador TI Recorrente"
            opportunityLabel="Oportunidade TI Recorrente"
            quantityLabel="Licenças"
            revenueLabel="Receita digital"
            conversionRate={appliedRate}
            onConversionRateChange={setConversionRate}
            loading={isLoading}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Composição das oportunidades TI Recorrente"
              description={
                isLoading
                  ? "Tipos de oferta no recorte."
                  : `${fmtInt(composition.length)} ${composition.length === 1 ? "tipo de oferta" : "tipos de oferta"} no recorte, ordenados por quantidade de CNPJs.`
              }
            >
              <DistributionBody
                loading={isLoading}
                empty={composition.length === 0}
                emptyTitle="Sem composição disponível"
                emptyDescription="A base do Mapa Parque não retornou tipos de oferta para este recorte."
              >
                <CategoryDistribution data={composition} categoryKey="tipo" dataKey="valor" />
              </DistributionBody>
            </ChartCard>
            <ChartCard
              title="Base total por parceiro"
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
                  dataKey="baseElegivel"
                />
              </DistributionBody>
            </ChartCard>
            <ChartCard
              title="Potencial financeiro por cenário"
              description={
                potentialAdoption == null
                  ? "Adoção potencial a partir das oportunidades elegíveis e da conversão do simulador."
                  : `Adoção potencial de ${fmtInt(potentialAdoption)} ${potentialAdoption === 1 ? "cliente" : "clientes"} (${fmtInt(appliedRate)}% das oportunidades elegíveis), a R$ 34, R$ 62 e R$ 100 por cliente.`
              }
              className="lg:col-span-2"
            >
              <DistributionBody
                loading={isLoading}
                empty={financialScenarios.length === 0}
                emptyTitle="Sem base para projetar cenários"
                emptyDescription="Os cenários dependem das oportunidades elegíveis do recorte, que não foram retornadas pela base."
              >
                <BarSimple
                  data={financialScenarios}
                  xKey="cenario"
                  dataKey="valor"
                  valueFormatter={fmtBRLCompact}
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
