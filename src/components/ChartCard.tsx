import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Moldura de visualização.
 *
 * Sem gradiente decorativo, sem blobs desfocados, sem moldura aninhada e sem
 * deslocamento no hover: o card não é clicável e não deve sugerir interação.
 * O destaque pertence ao conteúdo do gráfico, não ao recipiente.
 */
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
    <Card className={cn("overflow-hidden p-0", className)}>
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold tracking-tight text-foreground">{title}</h3>
          {description && (
            <p className="mt-1 max-w-xl text-xs leading-5 text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="min-h-[272px] px-3 py-4">{children}</div>
    </Card>
  );
}
