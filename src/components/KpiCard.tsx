import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Info, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  icon?: LucideIcon;
  title: string;
  value: ReactNode;
  description?: string;
  tooltip?: string;
  loading?: boolean;
  emphasis?: boolean;
  className?: string;
  action?: ReactNode;
}

export function KpiCard({
  icon: Icon,
  title,
  value,
  description,
  tooltip,
  loading,
  emphasis,
  className,
  action,
}: Props) {
  return (
    <Card
      className={cn(
        "relative overflow-hidden rounded-2xl border p-5 shadow-elegant transition duration-300 hover:-translate-y-0.5 hover:shadow-elevated",
        emphasis ? "border-transparent bg-gradient-brand text-primary-foreground" : "bg-card",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {Icon && (
            <div
              className={
                "grid size-8 shrink-0 place-items-center rounded-lg " +
                (emphasis ? "bg-white/15" : "bg-accent text-accent-foreground")
              }
            >
              <Icon className="size-4" />
            </div>
          )}
          <span
            className={
              "text-xs font-medium tracking-wide uppercase " +
              (emphasis ? "text-white/80" : "text-muted-foreground")
            }
          >
            {title}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {action}
          {tooltip && (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    aria-label={`Sobre ${title}`}
                    className={
                      "rounded-md p-1 outline-none transition hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring " +
                      (emphasis ? "text-white/70 hover:bg-white/15" : "text-muted-foreground")
                    }
                  >
                    <Info className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  {tooltip}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </div>

      <div className="mt-3">
        {loading ? (
          <Skeleton className="h-9 w-28" />
        ) : (
          <div className="text-3xl font-semibold tracking-tight tabular-nums">{value}</div>
        )}
      </div>
      {description && (
        <p className={"mt-1.5 text-xs " + (emphasis ? "text-white/75" : "text-muted-foreground")}>
          {description}
        </p>
      )}
    </Card>
  );
}
