import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { KpiCard } from "@/components/KpiCard";
import { OpportunityFilterTooltip } from "@/components/OpportunityFilterTooltip";
import { ACTIVE_REVENUE_FILTER } from "@/lib/opportunity-filters";
import { ChartCard } from "@/components/ChartCard";
import { BarSimple } from "@/components/charts";
import { ErrorState } from "@/components/EmptyState";
import { useFtth } from "@/hooks/useData";
import { fmtInt, fmtPct } from "@/lib/format";
import { Wifi, MapPin, Signal } from "lucide-react";
import { Card } from "@/components/ui/card";
import { OpportunitySimulator } from "@/components/OpportunitySimulator";

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
        <div className="relative isolate">
          <div className="pointer-events-none absolute -left-20 -top-16 -z-10 size-72 rounded-full bg-cyan/10 blur-3xl" />
          <div className="pointer-events-none absolute right-0 top-40 -z-10 size-80 rounded-full bg-primary/10 blur-3xl" />
          <Card className="relative mb-7 overflow-hidden rounded-[2rem] border-cyan/20 bg-gradient-to-br from-cyan/[0.14] via-card to-primary/[0.12] p-6 shadow-elegant md:p-7">
            <div className="pointer-events-none absolute -left-12 -top-16 size-52 rounded-full bg-cyan/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 right-8 size-56 rounded-full bg-primary/20 blur-3xl" />
            <div className="relative flex items-center gap-4">
              <div className="grid size-11 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-elegant">
                <Wifi className="size-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                  Conectividade FTTH
                </p>
                <h2 className="mt-2 text-3xl font-semibold leading-[1.08] tracking-tight md:text-4xl">
                  Cobertura e renovação em foco.
                </h2>
              </div>
            </div>
          </Card>
          <div className="grid gap-4 md:grid-cols-2">
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
                  note="Conte clientes distintos. Use NR_CNPJ; se a coluna não existir, use COD_CLIENTE."
                />
              }
              loading={isLoading}
              emphasis
            />
            <KpiCard
              icon={Signal}
              title="Penetração na base"
              value={fmtPct(data?.kpis.penetracaoBase)}
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
                  note="Conte clientes distintos em cada grupo. Cálculo: Base ÷ (Base + Oportunidade)."
                />
              }
              loading={isLoading}
              className="rounded-3xl border-primary/20 bg-gradient-to-br from-card via-card to-primary/[0.1] p-6 shadow-elegant hover:shadow-elevated"
            />
          </div>

          <OpportunitySimulator
            rows={(data?.porParceiro ?? []).map((partner) => ({
              parceiro: partner.parceiro,
              oportunidades: partner.oportunidades,
            }))}
            storageKey="mapa-parque.ftth-simulators.v1"
            simulatorLabel="Simulador FTTH"
            opportunityLabel="Aquisição Fixa Básica"
            quantityLabel="BLs"
            revenueLabel="Receita FTTH"
          />

          <div className="mt-7 grid gap-5 lg:grid-cols-2">
            <ChartCard
              title="Oportunidade por cidade"
              action={
                <span className="rounded-full bg-cyan/[0.1] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300">
                  CNPJs
                </span>
              }
              className="border-cyan/15 bg-gradient-to-br from-card via-card to-cyan/[0.065] shadow-[0_18px_42px_-34px_hsl(190_85%_46%/0.45)]"
            >
              {data && (
                <BarSimple
                  data={data.geo}
                  xKey="cidade"
                  dataKey="oportunidades"
                  gradient={{ id: "ftth-city", from: "var(--chart-3)", to: "var(--chart-1)" }}
                />
              )}
            </ChartCard>
            <ChartCard
              title="Oportunidade por parceiro"
              action={
                <span className="rounded-full bg-primary/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                  Carteira
                </span>
              }
              className="border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.065] shadow-[0_18px_42px_-34px_hsl(var(--primary)/0.45)]"
            >
              {data && (
                <BarSimple
                  data={data.porParceiro}
                  xKey="parceiro"
                  dataKey="oportunidades"
                  gradient={{ id: "ftth-partners", from: "var(--chart-1)", to: "var(--primary)" }}
                />
              )}
            </ChartCard>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
