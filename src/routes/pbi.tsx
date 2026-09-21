import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, MonitorPlay } from "lucide-react";
import { DashboardLayout } from "@/layouts/DashboardLayout";

const POWER_BI_REPORTS = [
  {
    id: "certificacao",
    label: "Certificação",
    url: "https://app.powerbi.com/groups/me/reports/6cb65a90-4ea5-4917-8f89-2c588ac43942/d3cdc620745abb5b4843?ctid=9744600e-3e04-492e-baa1-25ec245c6f10&openReportSource=ReportInvitation&experience=power-bi",
  },
  {
    id: "financeiro",
    label: "Financeiro",
    url: "https://app.powerbi.com/groups/me/reports/81042095-7a13-40c1-946f-028ae933dc31/296c21f07208cbb3d917?experience=power-bi&clientSideAuth=0",
  },
  {
    id: "efetividade-ftth",
    label: "Efetividade FTTH",
    url: "https://app.powerbi.com/groups/me/reports/b46d70d4-b714-4aee-8544-c2939164ab15/a207ac1557d996e2080c?ctid=9744600e-3e04-492e-baa1-25ec245c6f10&openReportSource=ReportInvitation&experience=power-bi",
  },
  {
    id: "sustentabilidade-ftth",
    label: "Sustentabilidade FTTH",
    url: "https://app.powerbi.com/groups/me/apps/dd9cddf1-c0fc-4e43-a036-44d42f20bbda/web-contents/1ff01ed4-35a7-6c8e-0849-832c82ae6628?experience=power-bi",
  },
  {
    id: "ip-aceite",
    label: "IP Aceite",
    url: "https://app.powerbi.com/groups/me/reports/a70cf3db-67fd-4672-9178-15bbb08669c6/ReportSection?experience=power-bi",
  },
  {
    id: "qualidade",
    label: "Qualidade",
    url: "https://app.powerbi.com/groups/me/apps/6caa8b59-c4ec-4d4e-921f-b9a8486199d4/reports/e712ceb1-3b8f-4002-8560-7b671e1c6a2e/ReportSection?ctid=9744600e-3e04-492e-baa1-25ec245c6f10&experience=power-bi",
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
        <header className="flex items-center gap-3 border-b border-border pb-5">
          <div className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <MonitorPlay className="size-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
              Power BI
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Painéis</h1>
          </div>
        </header>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {POWER_BI_REPORTS.map((report) => (
            <a
              key={report.id}
              href={report.url}
              target="_blank"
              rel="noreferrer"
              aria-label={`Abrir ${report.label} no Power BI`}
              className="group relative overflow-hidden rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/35 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              <div className="relative flex items-center justify-between gap-4">
                <div className="flex items-start justify-between">
                  <div className="grid size-9 place-items-center rounded-lg bg-primary/[0.10] text-primary transition-colors duration-300 group-hover:bg-primary group-hover:text-primary-foreground">
                    <MonitorPlay className="size-5" />
                  </div>
                  <ArrowUpRight className="size-5 text-muted-foreground transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
                <h2 className="text-base font-semibold tracking-tight">{report.label}</h2>
              </div>
            </a>
          ))}
        </div>
      </section>
    </DashboardLayout>
  );
}
