import { useState, useMemo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronDown, Search, Users, X } from "lucide-react";
import { usePartnerFilter } from "@/contexts/AppContexts";
import { usePartners } from "@/hooks/useData";

export function PartnerFilter() {
  const { data: partners = [] } = usePartners();
  const { selected, toggle, clear, setSelected, isAll } = usePartnerFilter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () => partners.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())),
    [partners, q],
  );

  const label = isAll
    ? "Todos os parceiros"
    : selected.length === 1
      ? partners.find((p) => p.id === selected[0])?.name ?? "1 parceiro"
      : `${selected.length} parceiros`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-10 min-w-[180px] justify-between gap-2 rounded-xl bg-card"
        >
          <div className="flex min-w-0 items-center gap-2">
            <Users className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-sm">{label}</span>
          </div>
          <div className="flex items-center gap-1">
            {!isAll && (
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
            onClick={() => setSelected(partners.map((p) => p.id))}
            className="text-muted-foreground hover:text-foreground"
          >
            Selecionar todos
          </button>
          <button
            onClick={clear}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground disabled:opacity-40"
            disabled={isAll}
          >
            <X className="size-3" /> Limpar
          </button>
        </div>
        <ScrollArea className="max-h-[280px]">
          <ul className="p-1">
            {filtered.map((p) => {
              const checked = isAll || selected.includes(p.id);
              return (
                <li key={p.id}>
                  <button
                    onClick={() => {
                      if (isAll) {
                        setSelected(partners.filter((x) => x.id !== p.id).map((x) => x.id));
                      } else {
                        toggle(p.id);
                      }
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                  >
                    <Checkbox checked={checked} className="pointer-events-none" />
                    <span className="truncate">{p.name}</span>
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-3 py-6 text-center text-xs text-muted-foreground">Nenhum parceiro encontrado</li>
            )}
          </ul>
        </ScrollArea>
        <div className="border-t p-2 text-[11px] text-muted-foreground">
          {isAll ? "Considerando todos os parceiros" : `${selected.length} selecionado(s)`}
        </div>
      </PopoverContent>
    </Popover>
  );
}
