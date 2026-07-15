import { Inbox, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function EmptyState({ title = "Sem resultados", description }: { title?: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-card/50 px-6 py-10 text-center">
      <div className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
        <Inbox className="size-5" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-xs text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-destructive/40 bg-destructive/5 px-6 py-10 text-center">
      <div className="grid size-10 place-items-center rounded-xl bg-destructive/10 text-destructive">
        <AlertCircle className="size-5" />
      </div>
      <p className="text-sm font-medium">Não foi possível carregar os dados</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        Ocorreu uma falha ao consultar o serviço. Verifique sua conexão e tente novamente.
      </p>
      {onRetry && (
        <Button size="sm" onClick={onRetry} className="mt-1">
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
