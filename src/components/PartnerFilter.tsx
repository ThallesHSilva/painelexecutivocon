import { useEffect, useMemo, useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check, ChevronDown, Search, Users, X } from "lucide-react";
import { usePartnerFilter } from "@/contexts/AppContexts";
import { usePartners } from "@/hooks/useData";
import { useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

export function PartnerFilter() {
  const { data: mapaPartners = [] } = usePartners();
  const isQuartil = useRouterState({ select: (state) => state.location.pathname === "/quartil" });
  const { data: quartilPartners } = useQuery({
    queryKey: ["quartil-partners"],
    enabled: isQuartil,
    queryFn: async (): Promise<{ id: string; name: string }[]> => {
      const response = await fetch("/api/quartil?partnersOnly=1", { cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível carregar os parceiros.");
      return (await response.json()).partners;
    },
  });
  const partners = isQuartil ? (quartilPartners ?? mapaPartners) : mapaPartners;
  const { selected, toggle, clear, setSelected, allowedPartnerIds, role } = usePartnerFilter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const availablePartners = useMemo(
    () =>
      role === "gn" && allowedPartnerIds
        ? partners.filter((partner) => allowedPartnerIds.includes(partner.id))
        : partners,
    [partners, role, allowedPartnerIds],
  );
  useEffect(() => {
    if (!selected.length || role === null) return;
    const availableIds = new Set(availablePartners.map((partner) => partner.id));
    const validSelection = selected.filter((id) => availableIds.has(id));
    if (validSelection.length !== selected.length) setSelected(validSelection);
  }, [availablePartners, role, selected, setSelected]);
  const filtered = useMemo(
    () => availablePartners.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())),
    [availablePartners, q],
  );

  const hasSelection = selected.length > 0;
  const hasNoPartnerAccess =
    role === "gn" && allowedPartnerIds !== null && allowedPartnerIds.length === 0;
  const label = !hasSelection
    ? role === "gn"
      ? hasNoPartnerAccess
        ? "Nenhum parceiro autorizado"
        : "Parceiros vinculados"
      : "Todos os parceiros"
    : selected.length === 1
      ? (availablePartners.find((p) => p.id === selected[0])?.name ?? "1 parceiro")
      : `${selected.length} parceiros`;
  const handleClear = () => {
    clear();
    setQ("");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-10 min-w-[190px] justify-between gap-2 rounded-2xl border-primary/10 bg-card/70 px-3 shadow-sm transition hover:border-primary/25 hover:bg-primary/[0.05]"
        >
          <div className="flex min-w-0 items-center gap-2">
            <Users className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm">{label}</span>
          </div>
          <div className="flex items-center gap-1">
            {hasSelection && (
              <Badge variant="secondary" className="rounded-md px-1.5 py-0 text-[10px]">
                {selected.length}
              </Badge>
            )}
            <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[280px] rounded-xl p-0">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar parceiro..."
              className="h-9 pl-8 text-sm"
            />
          </div>
        </div>
        <div className="flex items-center justify-between border-b px-3 py-2 text-xs">
          <button
            onClick={() => setSelected(availablePartners.map((p) => p.id))}
            className="text-muted-foreground hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            disabled={hasNoPartnerAccess}
          >
            Selecionar todos
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
            disabled={!hasSelection && !q}
          >
            <X className="size-3" /> Limpar
          </button>
        </div>
        <ScrollArea className="h-[280px]">
          <ul className="p-1">
            {filtered.map((p) => {
              const checked = selected.includes(p.id);
              return (
                <li key={p.id}>
                  <button
                    onClick={() => toggle(p.id)}
                    role="checkbox"
                    aria-checked={checked}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-4 shrink-0 place-content-center rounded-full border border-primary/70 text-primary"
                    >
                      {checked && <Check className="size-3" strokeWidth={3} />}
                    </span>
                    <span className="truncate">{p.name}</span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground">
                {hasNoPartnerAccess
                  ? "Nenhum parceiro autorizado. Procure o Diretor para solicitar um vínculo."
                  : "Nenhum parceiro encontrado"}
              </li>
            )}
          </ul>
        </ScrollArea>
        <div className="border-t p-2 text-[11px] text-muted-foreground">
          {hasSelection
            ? `${selected.length} selecionado(s)`
            : hasNoPartnerAccess
              ? "Nenhum parceiro autorizado · procure o Diretor"
              : role === "gn"
                ? "Nenhum parceiro selecionado · visão dos parceiros atribuídos"
                : "Nenhum parceiro selecionado · visão consolidada"}
        </div>
      </PopoverContent>
    </Popover>
  );
}
