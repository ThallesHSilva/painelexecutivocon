import { Fragment, useState } from "react";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type CertificationQscField =
  "jan" | "feb" | "mar" | "apr" | "may" | "jun" | "totalizer" | "points" | "band";

export type CertificationQscRow = Record<CertificationQscField, string> & {
  id: string;
  indicator: string;
  accent: string;
};

const MONTH_FIELDS: CertificationQscField[] = ["jan", "feb", "mar", "apr", "may", "jun"];

/**
 * Identificação persistente na rolagem horizontal, igual à usada na tabela principal
 * da Certificação: o indicador continua visível enquanto os meses rolam.
 */
const STICKY_ID_CLASS = "sticky left-0 z-[1] whitespace-normal bg-card";
const STICKY_ID_GROUP_CLASS = "sticky left-0 z-[1] whitespace-normal bg-muted";
const FIELD_CLASS = "h-9 px-2 text-sm";

export function CertificationQscHistory({
  rows,
  totalPoints,
  monthLabels,
  onChange,
  readOnly = false,
}: {
  rows: CertificationQscRow[];
  totalPoints: string;
  /** Rótulos do ciclo ativo, usados apenas nos nomes acessíveis dos campos. */
  monthLabels: string[];
  onChange: (rowId: string, field: CertificationQscField, value: string) => void;
  readOnly?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  /**
   * Resultado fechado é texto; apenas o ciclo em simulação apresenta campo. Isso evita
   * que um valor somente de leitura pareça editável por estar dentro de um input.
   */
  const cell = (
    key: string,
    label: string,
    value: string,
    field: CertificationQscField,
    rowId: string,
    align: "numeric" | "state",
    className?: string,
  ) => (
    <TableCell key={key} align={align} className={className}>
      {readOnly ? (
        <span className="font-medium text-foreground">{value.trim() === "" ? "—" : value}</span>
      ) : (
        <Input
          aria-label={label}
          type="text"
          inputMode={align === "numeric" ? "decimal" : "text"}
          value={value}
          onChange={(event) => onChange(rowId, field, event.target.value)}
          className={cn(
            FIELD_CLASS,
            align === "numeric" ? "text-right tabular-nums" : "text-center",
          )}
        />
      )}
    </TableCell>
  );

  return (
    <Fragment>
      <TableRow className="bg-muted/60">
        <TableCell className={cn(STICKY_ID_GROUP_CLASS, "font-semibold text-foreground")}>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
            className="flex w-full items-center gap-2 rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ChevronDown
              aria-hidden="true"
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform duration-150",
                expanded && "rotate-180",
              )}
            />
            <span>QSC</span>
          </button>
        </TableCell>
        {MONTH_FIELDS.map((field) => (
          <TableCell key={field} aria-hidden="true" />
        ))}
        <TableCell aria-hidden="true" />
        {cell(
          "qsc-total-points",
          "Pontuação total do QSC",
          totalPoints,
          "points",
          "qsc-total",
          "numeric",
          "font-semibold",
        )}
        <TableCell aria-hidden="true" />
      </TableRow>
      {expanded &&
        rows.map((row) => (
          <TableRow key={row.id}>
            {/* O indicador é identificado pelo nome; a cor não carregava significado aqui. */}
            <TableCell className={cn(STICKY_ID_CLASS, "pl-8 font-medium text-foreground")}>
              {row.indicator}
            </TableCell>
            {MONTH_FIELDS.map((field, index) =>
              cell(
                field,
                `${monthLabels[index] ?? field} de ${row.indicator}`,
                row[field],
                field,
                row.id,
                "numeric",
              ),
            )}
            {cell(
              "totalizer",
              `Totalizador de ${row.indicator}`,
              row.totalizer,
              "totalizer",
              row.id,
              "numeric",
            )}
            {cell("points", `Pts de ${row.indicator}`, row.points, "points", row.id, "numeric")}
            {cell("band", `Faixa de ${row.indicator}`, row.band, "band", row.id, "state")}
          </TableRow>
        ))}
    </Fragment>
  );
}
