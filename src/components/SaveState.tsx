import { Check, LoaderCircle, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

/**
 * Estado de gravação compartilhado.
 *
 * Um único vocabulário para salvamento automático: ocioso, salvando, salvo e falha.
 * Cada estado tem palavra e ícone além da cor, e é anunciado por leitor de tela.
 * Não altera quando nem o que é gravado — apenas informa o que já acontece.
 */
export function SaveState({
  status,
  busy = false,
  className,
}: {
  status: SaveStatus;
  /** Carga inicial em andamento: mostra "salvando" sem alterar o estado real. */
  busy?: boolean;
  className?: string;
}) {
  const effective: SaveStatus = busy ? "saving" : status;
  const content = {
    idle: { label: "Salvamento automático", icon: null, tone: "text-muted-foreground" },
    saving: {
      label: "Salvando",
      icon: <LoaderCircle className="size-3.5 animate-spin" />,
      tone: "text-muted-foreground",
    },
    saved: { label: "Salvo", icon: <Check className="size-3.5" />, tone: "text-success" },
    error: {
      label: "Falha ao salvar",
      icon: <TriangleAlert className="size-3.5" />,
      tone: "text-destructive",
    },
  }[effective];

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-sm border border-border px-3 text-xs font-medium",
        content.tone,
        className,
      )}
    >
      {content.icon}
      {content.label}
    </span>
  );
}
