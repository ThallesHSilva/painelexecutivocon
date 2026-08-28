import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { KpiCard } from "@/components/KpiCard";
import { ChartCard } from "@/components/ChartCard";
import { BarSimple } from "@/components/charts";
import { ErrorState } from "@/components/EmptyState";
import { useAdvanced } from "@/hooks/useData";
import { fmtInt, fmtPct } from "@/lib/format";
import { Cpu, Percent, RefreshCw, Rocket, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/avancada")({
  head: () => ({ meta: [{ title: "Oportunidade Avançada — Mapa Parque" }] }),
  component: Page,
});

function Page() {
  const { data, isLoading, error, refetch } = useAdvanced();

  return (
    <DashboardLayout title="Oportunidade Avançada">
      {error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <>
          <Card className="relative mb-7 overflow-hidden rounded-[2rem] border-violet-400/20 bg-gradient-to-br from-violet-500/[0.15] via-card to-primary/[0.12] p-6 shadow-elegant md:p-7">
            <div className="pointer-events-none absolute -left-12 -top-16 size-52 rounded-full bg-violet-500/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 right-8 size-56 rounded-full bg-primary/20 blur-3xl" />
            <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="max-w-2xl">
                <div className="flex items-center gap-3">
                  <div className="grid size-11 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-elegant">
                    <Sparkles className="size-5" />
                  </div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Portfólio especialista</p>
                </div>
                <h2 className="mt-5 text-3xl font-semibold leading-[1.08] tracking-tight md:text-4xl">
                  Oportunidades avançadas em foco.
                </h2>
              </div>
            </div>
          </Card>

          <section>
            <div className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Potencial mapeado</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Visão da oportunidade</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                icon={Rocket}
                title="Oportunidade Avançada"
                value={fmtInt(data?.kpis.acquisitionWinback)}
                tooltip="NR_CNPJ distintos elegíveis com AVANCADOS iniciado por Aquisição ou Winback."
                loading={isLoading}
                emphasis
              />
              <KpiCard
                icon={RefreshCw}
                title="Renovação de Avançada"
                value={fmtInt(data?.kpis.renewal)}
                tooltip="NR_CNPJ distintos elegíveis com AVANCADOS iniciado por Renovação."
                loading={isLoading}
                className="border-violet-400/20 bg-gradient-to-br from-card via-card to-violet-500/[0.08]"
              />
              <KpiCard
                icon={Percent}
                title="% da base total"
                value={fmtPct(data?.kpis.percentualBase)}
                tooltip="Oportunidade Avançada dividida por todos os NR_CNPJ distintos da planilha."
                loading={isLoading}
                className="border-violet-400/20 bg-gradient-to-br from-card via-card to-violet-500/[0.08]"
              />
              <KpiCard
                icon={Cpu}
                title="Oportunidade Vivo Tech"
                value={fmtInt(data?.kpis.vivoTech)}
                tooltip="NR_CNPJ distintos elegíveis com recomendação preenchida na coluna VIVO_TECH."
                loading={isLoading}
                className="border-sky-400/25 bg-gradient-to-br from-card via-card to-sky-500/[0.1]"
              />
            </div>
          </section>

          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Oportunidade por parceiro"
              action={<span className="rounded-full bg-primary/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">CNPJs</span>}
              className="border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.065] shadow-[0_18px_42px_-34px_hsl(var(--primary)/0.45)]"
            >
              {data && <BarSimple data={data.porParceiro} xKey="parceiro" dataKey="oportunidades" gradient={{ id: "advanced-partners", from: "var(--chart-1)", to: "var(--primary)" }} />}
            </ChartCard>
            <ChartCard
              title="Oportunidade Avançada x Renovação"
              action={<span className="rounded-full bg-violet-500/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-600 dark:text-violet-300">CNPJs</span>}
              className="border-violet-400/15 bg-gradient-to-br from-card via-card to-violet-500/[0.065] shadow-[0_18px_42px_-34px_hsl(272_72%_55%/0.45)]"
            >
              {data && <BarSimple data={data.comparativo} xKey="tipo" dataKey="valor" gradient={{ id: "advanced-comparison", from: "var(--chart-4)", to: "var(--primary)" }} />}
            </ChartCard>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
