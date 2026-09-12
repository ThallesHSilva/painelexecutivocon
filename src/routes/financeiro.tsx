import { createFileRoute } from "@tanstack/react-router";
import { ExternalLink, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/layouts/DashboardLayout";

const FINANCIAL_POWER_BI_URL =
  "https://app.powerbi.com/groups/me/reports/81042095-7a13-40c1-946f-028ae933dc31/296c21f07208cbb3d917?experience=power-bi&clientSideAuth=0";

export const Route = createFileRoute("/financeiro")({
  head: () => ({ meta: [{ title: "Financeiro — Mapa Parque" }] }),
  component: FinancialPage,
});

function FinancialPage() {
  return (
    <DashboardLayout title="Financeiro">
      <section className="overflow-hidden rounded-[2rem] border border-emerald-500/20 bg-card shadow-elevated">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-emerald-500/15 bg-emerald-500/[0.04] px-5 py-5 md:px-7">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-2xl bg-emerald-500/[0.13] text-emerald-700 dark:text-emerald-300">
              <Landmark className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
                Power BI
              </p>
              <h1 className="text-lg font-semibold tracking-tight">Visão financeira</h1>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <a href={FINANCIAL_POWER_BI_URL} target="_blank" rel="noreferrer">
              Abrir no Power BI <ExternalLink className="size-4" />
            </a>
          </Button>
        </div>
        <iframe
          title="PBI Financeiro"
          src={FINANCIAL_POWER_BI_URL}
          className="min-h-[760px] w-full border-0"
          allowFullScreen
        />
      </section>
    </DashboardLayout>
  );
}
