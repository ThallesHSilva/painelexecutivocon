import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { Button } from "@/components/ui/button";

const POWER_BI_REPORT_URL =
  "https://app.powerbi.com/groups/me/reports/6cb65a90-4ea5-4917-8f89-2c588ac43942/d3cdc620745abb5b4843?ctid=9744600e-3e04-492e-baa1-25ec245c6f10&openReportSource=ReportInvitation&experience=power-bi";

export const Route = createFileRoute("/pbi")({
  head: () => ({ meta: [{ title: "PBI — Mapa Parque" }] }),
  component: PbiPage,
});

function PbiPage() {
  return (
    <DashboardLayout title="PBI">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
              Power BI
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">Painel executivo</h1>
          </div>
          <Button asChild variant="outline" size="sm">
            <a href={POWER_BI_REPORT_URL} target="_blank" rel="noreferrer">
              Abrir no Power BI
              <ExternalLink className="size-4" />
            </a>
          </Button>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card p-6 text-sm text-muted-foreground shadow-sm">
          Acesse o painel diretamente no Power BI pelo botão acima.
        </div>
      </div>
    </DashboardLayout>
  );
}
