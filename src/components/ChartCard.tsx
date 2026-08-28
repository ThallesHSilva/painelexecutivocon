import { Card } from "@/components/ui/card";
import type { ReactNode } from "react";

export function ChartCard({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={
        "group relative overflow-hidden rounded-[1.6rem] border border-border/70 bg-gradient-to-br from-card via-card to-muted/[0.28] p-0 shadow-[0_22px_54px_-42px_hsl(var(--foreground)/0.55)] transition duration-300 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-[0_28px_64px_-42px_hsl(var(--primary)/0.42)] " +
        (className ?? "")
      }
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/55 to-transparent" />
      <div className="pointer-events-none absolute -right-12 -top-16 size-40 rounded-full bg-primary/[0.07] blur-3xl transition duration-500 group-hover:scale-125" />
      <div className="relative px-5 pb-3 pt-5">
        <div className={(description ? "mb-4" : "mb-3") + " flex items-start justify-between gap-3"}>
          <div className="min-w-0">
            <div className="mb-2 h-1 w-9 rounded-full bg-gradient-brand opacity-90" />
            <h3 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h3>
            {description && <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">{description}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      </div>
      <div className="relative mx-3 mb-3 min-h-[272px] rounded-[1.15rem] border border-border/55 bg-background/[0.48] px-2 pb-1 pt-1 shadow-[inset_0_1px_0_hsl(var(--background)/0.8)]">
        {children}
      </div>
    </Card>
  );
}
