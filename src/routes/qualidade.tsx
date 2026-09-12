import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardLayout } from "@/layouts/DashboardLayout";

const QUALITY_REPORTS = [
  {
    id: "efetividade",
    label: "Efetividade FTTH",
    url: "https://app.powerbi.com/groups/me/reports/b46d70d4-b714-4aee-8544-c2939164ab15/a207ac1557d996e2080c?ctid=9744600e-3e04-492e-baa1-25ec245c6f10&openReportSource=ReportInvitation&experience=power-bi",
  },
  {
    id: "sustentabilidade",
    label: "Sustentabilidade FTTH",
    url: "https://app.powerbi.com/groups/me/apps/dd9cddf1-c0fc-4e43-a036-44d42f20bbda/web-contents/1ff01ed4-35a7-6c8e-0849-832c82ae6628?experience=power-bi",
  },
  {
    id: "aceite",
    label: "IP Aceite",
    url: "https://app.powerbi.com/groups/me/reports/a70cf3db-67fd-4672-9178-15bbb08669c6/ReportSection?experience=power-bi",
  },
] as const;

export const Route = createFileRoute("/qualidade")({
  head: () => ({ meta: [{ title: "Qualidade — Mapa Parque" }] }),
  component: QualityPage,
});

function QualityPage() {
  const [reportId, setReportId] = useState<(typeof QUALITY_REPORTS)[number]["id"]>("efetividade");
  const report = QUALITY_REPORTS.find((item) => item.id === reportId) ?? QUALITY_REPORTS[0];

  return (
    <DashboardLayout title="Qualidade">
      <Card className="overflow-hidden rounded-[2rem] border-cyan-500/20 bg-card shadow-elevated">
        <div className="flex flex-col gap-4 border-b border-cyan-500/15 bg-cyan-500/[0.04] px-5 py-5 md:px-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-2xl bg-cyan-500/[0.13] text-cyan-700 dark:text-cyan-300">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700 dark:text-cyan-300">
                  Power BI
                </p>
                <h1 className="text-lg font-semibold tracking-tight">Qualidade</h1>
              </div>
            </div>
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <a href={report.url} target="_blank" rel="noreferrer">
                Abrir no Power BI <ExternalLink className="size-4" />
              </a>
            </Button>
          </div>
          <Tabs value={reportId} onValueChange={(value) => setReportId(value as typeof reportId)}>
            <TabsList className="h-auto flex-wrap justify-start gap-1 rounded-2xl bg-background/70 p-1.5">
              {QUALITY_REPORTS.map((item) => (
                <TabsTrigger
                  key={item.id}
                  value={item.id}
                  className="h-9 rounded-xl px-3 text-xs font-semibold"
                >
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
        <div className="px-5 py-7 md:px-7">
          <p className="text-sm text-muted-foreground">
            Selecione uma visão acima e abra o relatório diretamente no Power BI.
          </p>
        </div>
      </Card>
    </DashboardLayout>
  );
}
