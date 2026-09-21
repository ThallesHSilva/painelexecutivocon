import { Inbox, AlertCircle, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/**
 * Estados compartilhados de ausência e de erro.
 *
 * Mesma caixa, mesma tipografia e mesma área de ação para todos os casos, de modo
 * que "sem base", "sem resultados" e "sem vínculo" deixem de parecer telas diferentes.
 * Nenhum destes estados apresenta zero provisório no lugar do dado.
 */
function StateBox({
  icon: Icon,
  title,
  description,
  tone = "neutral",
  children,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  tone?: "neutral" | "danger";
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-10 text-center",
        tone === "danger" ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/40",
      )}
    >
      <Icon
        className={cn("size-5", tone === "danger" ? "text-destructive" : "text-muted-foreground")}
      />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      {children}
    </div>
  );
}

export function EmptyState({
  title = "Sem resultados",
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <StateBox icon={Inbox} title={title} description={description}>
      {action}
    </StateBox>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <StateBox
      icon={AlertCircle}
      tone="danger"
      title="Não foi possível carregar os dados"
      description="Ocorreu uma falha ao consultar o serviço. Verifique sua conexão e tente novamente. O recorte selecionado foi preservado."
    >
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} className="mt-1">
          Tentar novamente
        </Button>
      )}
    </StateBox>
  );
}
