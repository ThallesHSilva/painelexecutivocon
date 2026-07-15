import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { KpiCard } from "@/components/KpiCard";
import { ChartCard } from "@/components/ChartCard";
import { BarSimple, LineTrend } from "@/components/charts";
import { ErrorState } from "@/components/EmptyState";
import { useDataQuality } from "@/hooks/useData";
import { fmtInt } from "@/lib/format";
import { Database, Fingerprint, Copy, AlertTriangle, FileWarning, UserX, MinusCircle, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/qualidade")({
  head: () => ({ meta: [{ title: "Qualidade da Base — Mapa Parque" }] }),
  component: Page,
});

function Page() {
  const { data, isLoading, error, refetch } = useDataQuality();

  return (
    <DashboardLayout title="Qualidade da Base">
      {error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-4">
            <KpiCard icon={Database} title="Registros processados" value={fmtInt(data?.kpis.registrosProcessados)} loading={isLoading} />
            <KpiCard icon={Fingerprint} title="CNPJs distintos" value={fmtInt(data?.kpis.cnpjsDistintos)} loading={isLoading} />
            <KpiCard icon={Copy} title="Duplicidades" value={fmtInt(data?.kpis.duplicidades)} loading={isLoading} />
            <KpiCard icon={AlertTriangle} title="CNPJs inválidos" value={fmtInt(data?.kpis.cnpjsInvalidos)} loading={isLoading} />
            <KpiCard icon={FileWarning} title="Campos obrigatórios vazios" value={fmtInt(data?.kpis.camposVazios)} loading={isLoading} />
            <KpiCard icon={UserX} title="Registros sem parceiro" value={fmtInt(data?.kpis.semParceiro)} loading={isLoading} />
            <KpiCard icon={MinusCircle} title="Registros sem oportunidade" value={fmtInt(data?.kpis.semOportunidade)} loading={isLoading} />
            <KpiCard icon={Clock} title="Última carga" value={data?.kpis.ultimaCarga ?? "—"} loading={isLoading} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <ChartCard title="Problemas por tipo">
              {data && <BarSimple data={data.porTipo} xKey="tipo" dataKey="valor" color="var(--chart-2)" />}
            </ChartCard>
            <ChartCard title="Problemas por campo">
              {data && <BarSimple data={data.porCampo} xKey="campo" dataKey="valor" color="var(--chart-3)" />}
            </ChartCard>
            <ChartCard title="Evolução da qualidade" description="Percentual de qualidade da base ao longo do tempo." className="lg:col-span-2">
              {data && <LineTrend data={data.evolucao} xKey="mes" dataKey="qualidade" />}
            </ChartCard>
          </div>

          <Card className="mt-6 overflow-hidden rounded-2xl border shadow-elegant">
            <div className="border-b p-5">
              <h3 className="text-sm font-semibold tracking-tight">Exemplos de inconsistências</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Somente leitura. Correções são aplicadas no processamento.</p>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>CNPJ</TableHead>
                    <TableHead>Parceiro</TableHead>
                    <TableHead>Problema</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.exemplos.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-mono text-xs">{e.id}</TableCell>
                      <TableCell className="tabular-nums">{e.cnpj}</TableCell>
                      <TableCell>{e.parceiro}</TableCell>
                      <TableCell className="text-muted-foreground">{e.problema}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </DashboardLayout>
  );
}
