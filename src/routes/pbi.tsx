import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, MonitorPlay } from "lucide-react";
import { DashboardLayout } from "@/layouts/DashboardLayout";

import { POWER_BI_REPORTS } from "@/lib/power-bi-reports";

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
            <p className="page-subtitle text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
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
