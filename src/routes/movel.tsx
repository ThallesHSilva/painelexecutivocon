import { createFileRoute } from "@tanstack/react-router";
import { useMemo, type ReactNode } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { KpiCard } from "@/components/KpiCard";
import { OpportunityFilterTooltip } from "@/components/OpportunityFilterTooltip";
import { OpportunitySimulator } from "@/components/OpportunitySimulator";
import { ACTIVE_REVENUE_FILTER } from "@/lib/opportunity-filters";
import { ChartCard } from "@/components/ChartCard";
import { CategoryDistribution } from "@/components/charts";
import { EmptyState, ErrorState } from "@/components/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useMobile, usePartners } from "@/hooks/useData";
import { fmtBRL, fmtBRLCompact, fmtInt, fmtPct } from "@/lib/format";
import { CircleMinus, CreditCard, Download, RefreshCw, Smartphone, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportOpportunityBase } from "@/lib/export-xlsx";
import { usePartnerFilter } from "@/contexts/AppContexts";

/** Mesma chave e mesmo escopo de antes: os parâmetros já salvos continuam válidos. */
const SIMULATOR_STORAGE_KEY = "mapa-parque.mobile-simulators.v1";

export const Route = createFileRoute("/movel")({
  head: () => ({ meta: [{ title: "Oportunidades Móvel — Mapa Parque" }] }),
  component: Page,
});

function Page() {
  const { data, isLoading, error, refetch } = useMobile();
  const { effectiveSelected, selected, role, allowedPartnerIds } = usePartnerFilter();
  const { data: partners = [] } = usePartners();

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

  const partnerRows = data?.porParceiro ?? [];
  const composition = data?.composicao ?? [];

  const exportAction = (kind: Parameters<typeof exportOpportunityBase>[0], title: string) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={`Exportar base: ${title}`}
      aria-label={`Exportar base de clientes: ${title}`}
      className="size-8"
      onClick={() => exportOpportunityBase(kind, effectiveSelected)}
    >
      <Download className="size-4" />
    </Button>
  );

  return (
    <DashboardLayout title="Oportunidades Móvel">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold leading-[1.2] tracking-tight text-foreground md:text-[28px] md:leading-[34px]">
          Oportunidades Móvel
        </h1>
        <p className="mt-1.5 max-w-3xl text-sm leading-5 text-muted-foreground">
          Quanta oportunidade de linha e de aparelho existe no recorte e o que ela projeta em
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
          <section aria-labelledby="movel-linhas">
            <h2 id="movel-linhas" className="mb-2 text-[13px] font-semibold text-muted-foreground">
              Oportunidade de linha móvel · CNPJs do Mapa Parque no recorte
            </h2>
            <div className="grid gap-3 md:grid-cols-3">
              <KpiCard
                icon={UsersRound}
                title="Oportunidade Móvel"
                value={fmtInt(data?.kpis.baseRecMovel)}
                tooltip={
                  <OpportunityFilterTooltip
                    groups={[
                      {
                        title: "Filtro comum aos dois públicos",
                        rules: [ACTIVE_REVENUE_FILTER],
                      },
                      {
                        title: "1. Aquisição Móvel",
                        rules: [
                          {
                            column: "MOVEL",
                            selection: 'contém "Aquisição de Móvel"',
                          },
                        ],
                      },
                      {
                        title: "2. Renovação FTTH + Totalização",
                        rules: [
                          {
                            column: "FIXA_BASICA",
                            selection:
                              'contém "Upgrade de Fixa Básica" ou "Renovação de Fixa Básica"',
                          },
                          {
                            column: "QT_MOVEL_TERM",
                            selection: "selecione 0 e vazios",
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
                icon={Smartphone}
                title="Aquisição Móvel"
                value={fmtInt(data?.kpis.aquisicaoMovel)}
                tooltip={
                  <OpportunityFilterTooltip
                    groups={[
                      {
                        rules: [
                          ACTIVE_REVENUE_FILTER,
                          {
                            column: "MOVEL",
                            selection: 'contém "Aquisição de Móvel"',
                          },
                        ],
                      },
                    ]}
                  />
                }
                loading={isLoading}
              />
              <KpiCard
                icon={RefreshCw}
                title="Renovação FTTH + Totalização"
                value={fmtInt(data?.kpis.renovacaoFtthTotalizacao)}
                tooltip={
                  <OpportunityFilterTooltip
                    groups={[
                      {
                        rules: [
                          ACTIVE_REVENUE_FILTER,
                          {
                            column: "FIXA_BASICA",
                            selection:
                              'contém "Upgrade de Fixa Básica" ou "Renovação de Fixa Básica"',
                          },
                          {
                            column: "QT_MOVEL_TERM",
                            selection: "selecione 0 e vazios",
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

          <section aria-labelledby="movel-aparelhos">
            <h2
              id="movel-aparelhos"
              className="mb-2 text-[13px] font-semibold text-muted-foreground"
            >
              Oportunidade de aparelho · público com pré-aprovação de crédito
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                icon={CreditCard}
                title="Oportunidades Aparelhos"
                value={fmtInt(data?.kpis.oportunidadesAparelhos)}
                tooltip={
                  <OpportunityFilterTooltip
                    groups={[
                      {
                        rules: [
                          ACTIVE_REVENUE_FILTER,
                          {
                            column: "APARELHOS",
                            selection: 'contém "Capacidade de Pagamento"',
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
                icon={Smartphone}
                title="iPhone"
                value={fmtInt(data?.kpis.aparelhosIphone)}
                tooltip={
                  <OpportunityFilterTooltip
                    groups={[
                      {
                        rules: [
                          ACTIVE_REVENUE_FILTER,
                          {
                            column: "APARELHOS",
                            selection: 'contém "Capacidade de Pagamento" e contém "iPhone"',
                          },
                        ],
                      },
                    ]}
                  />
                }
                loading={isLoading}
              />
              <KpiCard
                icon={Smartphone}
                title="Galaxy S25/S26/Fold"
                value={fmtInt(data?.kpis.aparelhosGalaxyPremium)}
                tooltip={
                  <OpportunityFilterTooltip
                    groups={[
                      {
                        rules: [
                          ACTIVE_REVENUE_FILTER,
                          {
                            column: "APARELHOS",
                            selection:
                              'contém "Capacidade de Pagamento", contém "Galaxy" e contém S25, S26 ou Fold',
                          },
                        ],
                      },
                    ]}
                  />
                }
                loading={isLoading}
              />
              <KpiCard
                icon={CircleMinus}
                title="Outros aparelhos"
                value={fmtInt(data?.kpis.aparelhosOutros)}
                tooltip={
                  <OpportunityFilterTooltip
                    groups={[
                      {
                        rules: [
                          ACTIVE_REVENUE_FILTER,
                          {
                            column: "APARELHOS",
                            selection: 'contém "Capacidade de Pagamento"',
                          },
                          {
                            column: "APARELHOS",
                            selection: "exclua iPhone e exclua Galaxy S25, S26 ou Fold",
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

          <section aria-labelledby="movel-credito">
            <h2 id="movel-credito" className="mb-2 text-[13px] font-semibold text-muted-foreground">
              Crédito e renovação de aparelho · base exportável por público
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <KpiCard
                icon={CreditCard}
                title="Crédito de aparelho"
                value={fmtBRLCompact(data?.kpis.creditoAparelhos)}
                description={`Valor exato: ${fmtBRL(data?.kpis.creditoAparelhos)}`}
                loading={isLoading}
              />
              <KpiCard
                icon={RefreshCw}
                title="Renovação Móvel + Aparelho"
                value={fmtInt(data?.kpis.renovacaoMovelComAparelho)}
                description="CNPJs"
                loading={isLoading}
                action={exportAction("renovacao-aparelho", "Renovação Móvel + Aparelho")}
              />
              <KpiCard
                icon={CircleMinus}
                title="Aparelho sem renovação"
                value={fmtInt(data?.kpis.aparelhoSemRenovacao)}
                description="CNPJs"
                loading={isLoading}
                action={exportAction("aparelhos-sem-renovacao", "Aparelho sem renovação")}
              />
            </div>
          </section>

          <OpportunitySimulator
            rows={partnerRows.map((partner) => ({
              parceiro: partner.parceiro,
              oportunidades: partner.baseRecMovel,
            }))}
            storageKey={SIMULATOR_STORAGE_KEY}
            simulatorLabel="Simulador móvel"
            opportunityLabel="Oportunidade Móvel"
            quantityLabel="Linhas"
            revenueLabel="Receita móvel"
            loading={isLoading}
          />

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Composição das oportunidades móveis"
              description={
                isLoading
                  ? "Tipos de oferta no recorte."
                  : `${composition.length} ${composition.length === 1 ? "tipo de oferta" : "tipos de oferta"} no recorte, ordenados por quantidade de CNPJs.`
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
              title="Oportunidade Móvel por parceiro"
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
                  dataKey="baseRecMovel"
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
