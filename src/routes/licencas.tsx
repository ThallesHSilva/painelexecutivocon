import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { KpiCard } from "@/components/KpiCard";
import { ChartCard } from "@/components/ChartCard";
import { BarSimple, DonutChart } from "@/components/charts";
import { ErrorState } from "@/components/EmptyState";
import { useLicenses } from "@/hooks/useData";
import { fmtInt, fmtBRLCompact, fmtPct } from "@/lib/format";
import { UserCheck, Percent, Target, ShieldCheck, Scale, Rocket, SlidersHorizontal, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/licencas")({
  head: () => ({ meta: [{ title: "Licenças e Serviços Digitais — Mapa Parque" }] }),
  component: Page,
});

function Page() {
  const { data, isLoading, error, refetch } = useLicenses();
  const [conversionRate, setConversionRate] = useState(34);
  const appliedRate = Math.min(100, Math.max(0, conversionRate));
  const potentialAdoption = Math.round((data?.kpis.clientesElegiveis ?? 0) * (appliedRate / 100));
  const financialScenarios = [
    { cenario: "Conservador (R$34)", valor: potentialAdoption * 34 },
    { cenario: "Médio (R$62)", valor: potentialAdoption * 62 },
    { cenario: "Otimista (R$100)", valor: potentialAdoption * 100 },
  ];

  return (
    <DashboardLayout title="Licenças e Serviços Digitais">
      {error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <>
          <Card className="relative mb-7 overflow-hidden rounded-[2rem] border-primary/15 bg-gradient-to-br from-primary/[0.14] via-card to-cyan/[0.12] p-6 shadow-elegant md:p-7">
            <div className="pointer-events-none absolute -left-12 -top-16 size-52 rounded-full bg-primary/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 right-8 size-56 rounded-full bg-cyan/20 blur-3xl" />
            <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
              <div className="flex items-start gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-elegant">
                  <Sparkles className="size-5" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                    Crescimento digital
                  </p>
                  <h2 className="mt-5 text-3xl font-semibold leading-[1.08] tracking-tight md:text-4xl">
                  Cenários para acelerar a adesão
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-3 self-start rounded-2xl border border-primary/15 bg-background/75 p-2 pl-3 shadow-sm backdrop-blur md:self-auto">
                <SlidersHorizontal className="size-4 text-primary" />
                <div className="leading-tight">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Conversão</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Taxa aplicada</p>
                </div>
                <div className="flex items-center rounded-xl bg-primary/[0.07] px-2">
                  <Input
                    aria-label="Taxa de conversão"
                    className="h-10 w-14 border-0 bg-transparent px-0 text-right text-base font-semibold tabular-nums shadow-none focus-visible:ring-0"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    value={appliedRate}
                    onChange={(event) => setConversionRate(Number(event.target.value) || 0)}
                  />
                  <span className="pl-1 text-sm font-semibold text-primary">%</span>
                </div>
              </div>
            </div>
          </Card>
          <section>
            <div className="mb-4 flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Carteira digital</p>
                <h2 className="mt-1 text-xl font-semibold tracking-tight">Oportunidade em foco</h2>
              </div>
              <span className="rounded-full border border-primary/10 bg-primary/[0.06] px-3 py-1.5 text-xs font-medium text-primary">
                {data ? `${data.composicao.length} tipos de oferta` : "Carregando ofertas"}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <KpiCard icon={UserCheck} title="Oportunidade Digital" value={fmtInt(data?.kpis.clientesElegiveis)} tooltip="NR_CNPJ distintos elegíveis com a coluna DIGITAL_1 preenchida." loading={isLoading} className="border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.08]" />
              <KpiCard icon={Percent} title="% da base total" value={fmtPct(data?.kpis.percentualBase)} tooltip="Oportunidade Digital dividida por todos os NR_CNPJ distintos da planilha." loading={isLoading} className="border-violet-400/20 bg-gradient-to-br from-card via-card to-violet-500/[0.08]" />
              <KpiCard icon={Target} title="Potencial de adesão" value={fmtInt(potentialAdoption)} tooltip="Oportunidade Digital multiplicada pela taxa de conversão selecionada." loading={isLoading} className="border-cyan/20 bg-gradient-to-br from-card via-card to-cyan/[0.1]" />
            </div>
          </section>

          <section className="mt-7">
            <div className="mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">Projeção comercial</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Cenários por ticket</h2>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <KpiCard icon={ShieldCheck} title="Cenário R$ 34" value={fmtBRLCompact(financialScenarios[0].valor)} description="Ticket conservador" loading={isLoading} className="border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.08]" />
              <KpiCard icon={Scale} title="Cenário R$ 62" value={fmtBRLCompact(financialScenarios[1].valor)} description="Ticket médio" loading={isLoading} className="border-violet-400/20 bg-gradient-to-br from-card via-card to-violet-500/[0.08]" />
              <KpiCard icon={Rocket} title="Cenário R$ 100" value={fmtBRLCompact(financialScenarios[2].valor)} description="Ticket otimista" loading={isLoading} emphasis />
            </div>
          </section>

          <div className="mt-7 grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Base total por parceiro"
              action={<span className="rounded-full bg-primary/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">CNPJs</span>}
              className="border-primary/10 bg-gradient-to-br from-card via-card to-primary/[0.06] shadow-[0_18px_42px_-34px_hsl(var(--primary)/0.6)]"
            >
              {data && <BarSimple data={data.porParceiro} xKey="parceiro" dataKey="baseElegivel" gradient={{ id: "licenses-partners", from: "var(--chart-1)", to: "var(--primary)" }} />}
            </ChartCard>
            <ChartCard
              title="Composição das oportunidades digitais"
              action={<span className="rounded-full bg-violet-500/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-600 dark:text-violet-300">Mix</span>}
              className="border-violet-400/15 bg-gradient-to-br from-card via-card to-violet-500/[0.06] shadow-[0_18px_42px_-34px_hsl(272_72%_55%/0.45)]"
            >
              {data && <DonutChart data={data.composicao} nameKey="tipo" dataKey="valor" centerLabel={fmtInt(data.kpis.clientesElegiveis)} />}
            </ChartCard>
            <ChartCard
              title="Potencial financeiro por cenário"
              action={<span className="rounded-full bg-cyan/[0.1] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-700 dark:text-cyan-300">Receita</span>}
              className="border-cyan/15 bg-gradient-to-br from-card via-card to-cyan/[0.065] shadow-[0_18px_42px_-34px_hsl(190_85%_46%/0.45)] lg:col-span-2"
            >
              {data && <BarSimple data={financialScenarios} xKey="cenario" dataKey="valor" gradient={{ id: "licenses-financial", from: "var(--chart-2)", to: "var(--primary)" }} valueFormatter={fmtBRLCompact} />}
            </ChartCard>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
