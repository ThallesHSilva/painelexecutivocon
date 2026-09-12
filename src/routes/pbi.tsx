import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, MonitorPlay } from "lucide-react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const POWER_BI_REPORTS = [
  {
    id: "certificacao",
    label: "Certificação",
    description: "Resultado e acompanhamento da certificação comercial.",
    url: "https://app.powerbi.com/groups/me/reports/6cb65a90-4ea5-4917-8f89-2c588ac43942/d3cdc620745abb5b4843?ctid=9744600e-3e04-492e-baa1-25ec245c6f10&openReportSource=ReportInvitation&experience=power-bi",
  },
  {
    id: "financeiro",
    label: "Financeiro",
    description: "Visão financeira consolidada.",
    url: "https://app.powerbi.com/groups/me/reports/81042095-7a13-40c1-946f-028ae933dc31/296c21f07208cbb3d917?experience=power-bi&clientSideAuth=0",
  },
  {
    id: "efetividade-ftth",
    label: "Efetividade FTTH",
    description: "Indicadores de efetividade de FTTH.",
    url: "https://app.powerbi.com/groups/me/reports/b46d70d4-b714-4aee-8544-c2939164ab15/a207ac1557d996e2080c?ctid=9744600e-3e04-492e-baa1-25ec245c6f10&openReportSource=ReportInvitation&experience=power-bi",
  },
  {
    id: "sustentabilidade-ftth",
    label: "Sustentabilidade FTTH",
    description: "Indicadores de sustentabilidade de FTTH.",
    url: "https://app.powerbi.com/groups/me/apps/dd9cddf1-c0fc-4e43-a036-44d42f20bbda/web-contents/1ff01ed4-35a7-6c8e-0849-832c82ae6628?experience=power-bi",
  },
  {
    id: "ip-aceite",
    label: "IP Aceite",
    description: "Acompanhamento de aceite digital.",
    url: "https://app.powerbi.com/groups/me/reports/a70cf3db-67fd-4672-9178-15bbb08669c6/ReportSection?experience=power-bi",
  },
] as const;

export const Route = createFileRoute("/pbi")({
  head: () => ({ meta: [{ title: "PBI — Mapa Parque" }] }),
  component: PbiPage,
});

function PbiPage() {
  return (
    <DashboardLayout title="PBI">
      <section className="space-y-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">Power BI</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Painéis externos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Selecione o painel desejado para abri-lo diretamente no Power BI.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {POWER_BI_REPORTS.map((report) => (
            <Card key={report.id} className="rounded-3xl border-primary/15 bg-card p-5 shadow-sm">
              <div className="grid size-10 place-items-center rounded-2xl bg-primary/[0.1] text-primary">
                <MonitorPlay className="size-5" />
              </div>
              <h2 className="mt-4 font-semibold tracking-tight">{report.label}</h2>
              <p className="mt-1 min-h-10 text-sm text-muted-foreground">{report.description}</p>
              <Button asChild variant="outline" size="sm" className="mt-5 rounded-xl">
                <a href={report.url} target="_blank" rel="noreferrer">
                  Abrir no Power BI <ExternalLink className="size-4" />
                </a>
              </Button>
            </Card>
          ))}
        </div>
      </section>
    </DashboardLayout>
  );
}
