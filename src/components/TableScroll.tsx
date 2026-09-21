import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Área de rolagem horizontal com indicação explícita.
 *
 * Tabelas largas continuam roláveis como hoje; o que muda é a leitura: uma legenda
 * aparece enquanto houver conteúdo fora da área visível e some quando a tabela cabe
 * ou quando a rolagem chega ao fim. Não altera colunas, dados nem ordenação.
 */
export function TableScroll({
  children,
  className,
  hint = "Role na horizontal para ver todas as colunas.",
}: {
  children: ReactNode;
  className?: string;
  hint?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);
  const [atEnd, setAtEnd] = useState(false);

  /**
   * A primitiva `Table` já traz o próprio contêiner com `overflow-auto`, então quem
   * rola pode ser um descendente. Medir o elemento errado deixaria a indicação muda.
   */
  const scroller = useCallback((): HTMLElement | null => {
    const node = ref.current;
    if (!node) return null;
    if (node.scrollWidth - node.clientWidth > 4) return node;
    const candidates = node.querySelectorAll<HTMLElement>("div");
    for (const candidate of candidates) {
      const overflowX = getComputedStyle(candidate).overflowX;
      if (
        (overflowX === "auto" || overflowX === "scroll") &&
        candidate.scrollWidth - candidate.clientWidth > 4
      ) {
        return candidate;
      }
    }
    return node;
  }, []);

  const measure = useCallback(() => {
    const node = scroller();
    if (!node) return;
    const overflow = node.scrollWidth - node.clientWidth;
    setOverflowing(overflow > 4);
    setAtEnd(node.scrollLeft >= overflow - 4);
  }, [scroller]);

  useEffect(() => {
    measure();
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    const inner = scroller();
    if (inner && inner !== node) {
      observer.observe(inner);
      inner.addEventListener("scroll", measure, { passive: true });
      return () => {
        inner.removeEventListener("scroll", measure);
        observer.disconnect();
      };
    }
    return () => observer.disconnect();
  }, [measure, scroller, children]);

  return (
    <div className="relative">
      <div
        ref={ref}
        onScroll={measure}
        role="group"
        aria-label="Tabela com rolagem horizontal"
        className={cn("overflow-x-auto", className)}
      >
        {children}
      </div>
      {overflowing && !atEnd && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-10 rounded-r-2xl bg-gradient-to-l from-background to-transparent"
        />
      )}
      {overflowing && <p className="mt-2 text-[11px] font-medium text-muted-foreground">{hint}</p>}
    </div>
  );
}
