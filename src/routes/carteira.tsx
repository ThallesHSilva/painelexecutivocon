import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { ErrorState, EmptyState } from "@/components/EmptyState";
import { usePortfolio, useClient } from "@/hooks/useData";
import { fmtInt, fmtBRLCompact } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowUpDown, ChevronLeft, ChevronRight, Columns3, Download } from "lucide-react";
import type { PortfolioRow } from "@/mocks/data";

export const Route = createFileRoute("/carteira")({
  head: () => ({ meta: [{ title: "Carteira Detalhada — Mapa Parque" }] }),
  component: Page,
});

type ColKey =
  | "partnerName"
  | "cnpj"
  | "razaoSocial"
  | "municipio"
  | "uf"
  | "parqueMovel"
  | "recMovel"
  | "oportMovel"
  | "oportFtth"
  | "oportLicencas"
  | "servicosDigitais"
  | "qtdOportunidades"
  | "potencial";

const COLUMNS: { key: ColKey; label: string; align?: "right"; fixed?: boolean }[] = [
  { key: "partnerName", label: "Parceiro", fixed: true },
  { key: "cnpj", label: "CNPJ", fixed: true },
  { key: "razaoSocial", label: "Razão social" },
  { key: "municipio", label: "Município" },
  { key: "uf", label: "UF" },
  { key: "parqueMovel", label: "Parque móvel", align: "right" },
  { key: "recMovel", label: "REC_MOVEL", align: "right" },
  { key: "oportMovel", label: "Oport. Móvel" },
  { key: "oportFtth", label: "Oport. FTTH" },
  { key: "oportLicencas", label: "Oport. Licenças" },
  { key: "servicosDigitais", label: "Serviços digitais" },
  { key: "qtdOportunidades", label: "Qtd. oport.", align: "right" },
  { key: "potencial", label: "Potencial", align: "right" },
];

function exportCsv(rows: PortfolioRow[]) {
  const header = COLUMNS.map((c) => c.label).join(";");
  const lines = rows.map((r) =>
    [
      r.partnerName,
      r.cnpj,
      r.razaoSocial,
      r.municipio,
      r.uf,
      r.parqueMovel,
      r.recMovel,
      r.oportMovel ? "Sim" : "Não",
      r.oportFtth ? "Sim" : "Não",
      r.oportLicencas ? "Sim" : "Não",
      r.servicosDigitais ? "Sim" : "Não",
      r.qtdOportunidades,
      r.potencial,
    ]
      .map((v) => String(v).replace(/;/g, ","))
      .join(";"),
  );
  const csv = "\uFEFF" + [header, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "carteira.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function Page() {
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const { data, isLoading, error, refetch } = usePortfolio(page, pageSize);
  const [sortKey, setSortKey] = useState<ColKey>("partnerName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [visible, setVisible] = useState<Record<ColKey, boolean>>(
    Object.fromEntries(COLUMNS.map((c) => [c.key, true])) as Record<ColKey, boolean>,
  );
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: client } = useClient(openId);

  const rows = useMemo(() => {
    if (!data) return [];
    const arr = [...data.rows];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (typeof av === "number" && typeof bv === "number") return sortDir === "asc" ? av - bv : bv - av;
      return sortDir === "asc"
        ? String(av).localeCompare(String(bv), "pt-BR")
        : String(bv).localeCompare(String(av), "pt-BR");
    });
    return arr;
  }, [data, sortKey, sortDir]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;

  function toggleSort(k: ColKey) {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  }

  return (
    <DashboardLayout title="Carteira Detalhada">
      {error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <Card className="overflow-hidden rounded-2xl border shadow-elegant">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
            <div>
              <h3 className="text-sm font-semibold tracking-tight">Clientes da carteira</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {data ? `${fmtInt(data.total)} clientes • página ${page} de ${totalPages}` : "Carregando..."}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="rounded-xl">
                    <Columns3 className="mr-1.5 size-4" /> Colunas
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Exibir colunas</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {COLUMNS.map((c) => (
                    <DropdownMenuCheckboxItem
                      key={c.key}
                      checked={visible[c.key]}
                      disabled={c.fixed}
                      onCheckedChange={(v) => setVisible((s) => ({ ...s, [c.key]: !!v }))}
                    >
                      {c.label}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => data && exportCsv(data.rows)}
              >
                <Download className="mr-1.5 size-4" /> Exportar CSV
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {COLUMNS.filter((c) => visible[c.key]).map((c) => (
                    <TableHead
                      key={c.key}
                      className={
                        (c.align === "right" ? "text-right " : "") +
                        (c.fixed ? "sticky left-0 z-10 bg-card " : "") +
                        "whitespace-nowrap"
                      }
                    >
                      <button
                        onClick={() => toggleSort(c.key)}
                        className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground"
                      >
                        {c.label}
                        <ArrowUpDown className="size-3" />
                      </button>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading &&
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {COLUMNS.filter((c) => visible[c.key]).map((c) => (
                        <TableCell key={c.key}>
                          <Skeleton className="h-4 w-24" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                {!isLoading &&
                  rows.map((r) => (
                    <TableRow
                      key={r.id}
                      className="cursor-pointer transition hover:bg-accent/50"
                      onClick={() => setOpenId(r.id)}
                    >
                      {COLUMNS.filter((c) => visible[c.key]).map((c) => {
                        const v = r[c.key];
                        return (
                          <TableCell
                            key={c.key}
                            className={
                              (c.align === "right" ? "text-right tabular-nums " : "") +
                              (c.fixed ? "sticky left-0 z-[1] bg-card " : "") +
                              "whitespace-nowrap"
                            }
                          >
                            {typeof v === "boolean" ? (
                              v ? (
                                <Badge className="bg-primary/10 text-primary hover:bg-primary/15">Sim</Badge>
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )
                            ) : c.key === "potencial" ? (
                              fmtBRLCompact(Number(v))
                            ) : typeof v === "number" ? (
                              fmtInt(v)
                            ) : (
                              String(v)
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
            {!isLoading && rows.length === 0 && (
              <div className="p-6">
                <EmptyState description="Ajuste o filtro de parceiros para visualizar clientes." />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t p-3 text-xs text-muted-foreground">
            <span>
              {data ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, data.total)} de ${fmtInt(data.total)}` : "—"}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="icon"
                className="size-8 rounded-lg"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Página anterior"
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="px-2 tabular-nums">
                {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="icon"
                className="size-8 rounded-lg"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Próxima página"
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Sheet open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Detalhes do cliente</SheetTitle>
          </SheetHeader>
          {client ? (
            <div className="mt-4 space-y-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Razão social</div>
                <div className="font-medium">{client.razaoSocial}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-xs text-muted-foreground">CNPJ</div>
                  <div className="font-medium tabular-nums">{client.cnpj}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Parceiro responsável</div>
                  <div className="font-medium">{client.partnerName}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Município / UF</div>
                  <div className="font-medium">
                    {client.municipio} — {client.uf}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Potencial estimado</div>
                  <div className="font-medium">{fmtBRLCompact(client.potencial)}</div>
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Produtos atuais</div>
                <div className="flex flex-wrap gap-1.5">
                  {client.produtos.length ? (
                    client.produtos.map((p) => (
                      <Badge key={p} variant="secondary" className="rounded-md">
                        {p}
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">Nenhum produto ativo</span>
                  )}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Oportunidades identificadas</div>
                <div className="flex flex-wrap gap-1.5">
                  {client.oportMovel && <Badge className="bg-primary/10 text-primary">Móvel</Badge>}
                  {client.oportFtth && <Badge className="bg-primary/10 text-primary">FTTH</Badge>}
                  {client.oportLicencas && <Badge className="bg-primary/10 text-primary">Licenças</Badge>}
                  {client.servicosDigitais && <Badge className="bg-primary/10 text-primary">Serviços digitais</Badge>}
                </div>
              </div>
              <div>
                <div className="mb-1 text-xs text-muted-foreground">Justificativas</div>
                <ul className="list-disc space-y-1 pl-4 text-xs">
                  {client.justificativas.map((j, i) => (
                    <li key={i}>{j}</li>
                  ))}
                </ul>
              </div>
              <div className="text-[11px] text-muted-foreground">Atualizado em {client.atualizadoEm}</div>
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
