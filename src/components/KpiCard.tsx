import { useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Info, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  icon?: LucideIcon;
  title: string;
  value: ReactNode;
  description?: string;
  /** Ajuda comercial: colunas, valores e combinação dos filtros do Mapa Parque. */
  tooltip?: ReactNode;
  loading?: boolean;
  emphasis?: boolean;
  className?: string;
  action?: ReactNode;
}

/**
 * Ajuda comercial do "i".
 *
 * O conteúdo é o mesmo já aprovado (coluna, seleção e combinação dos filtros); o que
 * muda é o acesso: abre por clique e por toque, responde a Enter/Espaço e ao Esc, e
 * continua abrindo no hover do mouse. O tooltip anterior dependia de hover/foco e
 * ficava inacessível no celular. `pointerType` evita que o hover emulado do toque
 * abra e o clique seguinte feche a ajuda no mesmo gesto.
 */
function FilterHelp({
  label,
  emphasis,
  children,
}: {
  label: string;
  emphasis?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pinned = useRef(false);
  const openedByHover = useRef(false);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        pinned.current = next;
        openedByHover.current = false;
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Filtros de ${label}`}
          onPointerEnter={(event) => {
            if (event.pointerType !== "mouse" || open) return;
            openedByHover.current = true;
            setOpen(true);
          }}
          onPointerLeave={(event) => {
            if (event.pointerType !== "mouse" || pinned.current) return;
            setOpen(false);
          }}
          className={cn(
            "grid size-8 shrink-0 place-items-center rounded-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            emphasis
              ? "text-primary-foreground/85 hover:bg-primary-foreground/15 hover:text-primary-foreground"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <Info className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        collisionPadding={12}
        onOpenAutoFocus={(event) => {
          if (openedByHover.current) event.preventDefault();
        }}
        className="w-auto max-w-[min(22rem,calc(100vw-2rem))] p-3 text-xs leading-5"
      >
        <p className="mb-2 text-xs font-semibold text-foreground">{label}</p>
        {children}
      </PopoverContent>
    </Popover>
  );
}

/**
 * KPI: rótulo, valor e contexto opcional.
 *
 * O card não é clicável, então não se desloca nem ganha sombra no hover. O destaque
 * de `emphasis` usa a cor primária sólida, sem gradiente decorativo. O título quebra
 * em duas linhas em vez de truncar: nome de oferta cortado não identifica o público.
 */
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
        "relative flex flex-col p-4 md:p-5",
        emphasis && "border-primary bg-primary text-primary-foreground",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          {Icon && (
            <Icon
              className={cn(
                "mt-px size-4 shrink-0",
                emphasis ? "text-primary-foreground" : "text-muted-foreground",
              )}
            />
          )}
          <span
            className={cn(
              "min-w-0 text-xs font-semibold leading-4",
              emphasis ? "text-primary-foreground/85" : "text-muted-foreground",
            )}
          >
            {title}
          </span>
        </div>
        <div className="-mr-1 -mt-1 flex shrink-0 items-center gap-0.5">
          {action}
          {tooltip && (
            <FilterHelp label={title} emphasis={emphasis}>
              {tooltip}
            </FilterHelp>
          )}
        </div>
      </div>

      <div className="mt-3">
        {loading ? (
          <Skeleton className="h-8 w-28" />
        ) : (
          <div className="text-2xl font-semibold leading-[30px] tracking-tight tabular-nums md:text-[28px] md:leading-[34px]">
            {value}
          </div>
        )}
      </div>
      {description && !loading && (
        <p
          className={cn(
            "mt-1.5 text-xs leading-4 tabular-nums",
            emphasis ? "text-primary-foreground/80" : "text-muted-foreground",
          )}
        >
          {description}
        </p>
      )}
    </Card>
  );
}
