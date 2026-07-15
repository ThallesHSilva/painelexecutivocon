import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { KpiCard } from "@/components/KpiCard";
import { ChartCard } from "@/components/ChartCard";
import { BarSimple, DonutChart } from "@/components/charts";
import { ErrorState } from "@/components/EmptyState";
import { useDashboard } from "@/hooks/useData";
import { usePartnerFilter } from "@/contexts/AppContexts";
import { fmtInt, fmtBRLCompact, fmtCompact, fmtPct } from "@/lib/format";
import {
  Building2,
  Users,
  Target,
  Smartphone,
  Wifi,
  Boxes,
  PhoneCall,
  Coins,
  UserCheck,
  Headset,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [{ title: "Visão Geral — Mapa Parque" }],
  }),
  component: VisaoGeral,
});

function VisaoGeral() {
  const { data, isLoading, error, refetch } = useDashboard();
  const { setSelected } = usePartnerFilter();

  return (
    <DashboardLayout title="Visão Geral">
      {error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            <KpiCard
              icon={Building2}
              title="Total de CNPJs"
              value={fmtInt(data?.kpis.cnpjs)}
              tooltip="CNPJs únicos presentes no MAPA PARQUE após processamento pelo backend."
              loading={isLoading}
            />
            <KpiCard
              icon={Users}
              title="Total de clientes"
              value={fmtInt(data?.kpis.clientes)}
              tooltip="Clientes distintos identificados na carteira."
              loading={isLoading}
            />
            <KpiCard
              icon={Target}
              title="Oportunidades identificadas"
              value={fmtInt(data?.kpis.oportunidades)}
              description="Móvel + FTTH + Licenças"
              tooltip="Total de oportunidades comerciais classificadas pelo backend."
              loading={isLoading}
              emphasis
            />
            <KpiCard
              icon={Coins}
              title="Potencial financeiro"
              value={fmtBRLCompact(data?.kpis.potencialFinanceiro)}
              tooltip="Potencial estimado considerando ticket médio e produtos elegíveis."
              loading={isLoading}
            />
            <KpiCard
              icon={Smartphone}
              title="Oportunidades móvel"
              value={fmtInt(data?.kpis.oportMovel)}
              tooltip="Clientes com oportunidade de móvel (base REC_MOVEL elegível)."
              loading={isLoading}
            />
            <KpiCard
              icon={Wifi}
              title="Oportunidades FTTH"
              value={fmtInt(data?.kpis.oportFtth)}
              tooltip="Clientes com cobertura FTTH e oportunidade comercial."
              loading={isLoading}
            />
            <KpiCard
              icon={Boxes}
              title="Oportunidades de licenças"
              value={fmtInt(data?.kpis.oportLicencas)}
              tooltip="Clientes elegíveis para licenças e serviços digitais."
              loading={isLoading}
            />
            <KpiCard
              icon={PhoneCall}
              title="Linhas móveis potenciais"
              value={fmtInt(data?.kpis.linhasPotenciais)}
              tooltip="Volume estimado de linhas potenciais a partir da base elegível."
              loading={isLoading}
            />
            <KpiCard
              icon={UserCheck}
              title="Contatos qualificados"
              value={fmtInt(data?.kpis.contatosQualificados)}
              tooltip="Contatos aptos para abordagem comercial."
              loading={isLoading}
            />
            <KpiCard
              icon={Headset}
              title="CX necessário"
              value={fmtInt(data?.kpis.cxNecessario)}
              tooltip="Capacidade de atendimento estimada pelo backend."
              loading={isLoading}
            />
            <KpiCard
              icon={BarChart3}
              title="% da base com oportunidade"
              value={fmtPct(data?.kpis.percentualComOportunidade)}
              tooltip="Proporção da base que possui ao menos uma oportunidade identificada."
              loading={isLoading}
            />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Distribuição das oportunidades por tipo"
              description="Composição do total de oportunidades classificadas."
            >
              {data && <DonutChart data={data.porTipo} nameKey="tipo" dataKey="valor" />}
            </ChartCard>
            <ChartCard
              title="Composição das oportunidades por parceiro"
              description="Ordem alfabética. Clique em um parceiro para filtrar."
            >
              {data && (
                <BarSimple
                  data={data.porParceiro}
                  xKey="parceiro"
                  dataKey="oportunidades"
                  onClickBar={(d: any) => d?.payload?.partnerId && setSelected([d.payload.partnerId])}
                />
              )}
            </ChartCard>
            <ChartCard
              title="Distribuição geográfica das oportunidades"
              description="Total de oportunidades por UF."
            >
              {data && <BarSimple data={data.geo} xKey="uf" dataKey="total" color="var(--chart-3)" />}
            </ChartCard>
            <ChartCard
              title="Composição da base por categoria"
              description="Perfil dos clientes conforme oportunidades identificadas."
            >
              {data && <BarSimple data={data.categorias} xKey="categoria" dataKey="valor" color="var(--chart-2)" />}
            </ChartCard>
          </div>

          <section className="mt-8">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <h2 className="text-sm font-semibold tracking-tight">Oportunidades em destaque</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {data?.destaques.map((d) => (
                <Card key={d.titulo} className="rounded-2xl border p-4 shadow-elegant">
                  <div className="text-xs text-muted-foreground">{d.titulo}</div>
                  <div className="mt-2 text-2xl font-semibold tabular-nums">{fmtCompact(d.valor)}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{d.hint}</div>
                </Card>
              ))}
            </div>
          </section>
        </>
      )}
    </DashboardLayout>
  );
}
