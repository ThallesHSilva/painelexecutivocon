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

export function CertificationQscHistory({
  rows,
  totalPoints,
  onChange,
}: {
  rows: CertificationQscRow[];
  totalPoints: string;
  onChange: (rowId: string, field: CertificationQscField, value: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Fragment>
      <TableRow className="bg-primary/[0.045] hover:bg-primary/[0.07]">
        <TableCell className="px-4">
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
            className="group flex w-full items-center gap-3 text-left font-semibold text-foreground"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-primary/[0.13] text-primary transition-colors group-hover:bg-primary/[0.2]">
              <ChevronDown
                className={cn("size-4 transition-transform", expanded && "rotate-180")}
              />
            </span>
            <span>QSC</span>
          </button>
        </TableCell>
        {MONTH_FIELDS.map((field) => (
          <TableCell key={field} aria-hidden="true" />
        ))}
        <TableCell aria-hidden="true" />
        <TableCell>
          <Input
            aria-label="Pontuação total do QSC"
            type="text"
            inputMode="decimal"
            value={totalPoints}
            onChange={(event) => onChange("qsc-total", "points", event.target.value)}
            className="h-9 rounded-xl border-primary/25 bg-primary/[0.07] px-2.5 text-right text-sm font-bold tabular-nums shadow-sm focus-visible:border-primary/50 focus-visible:ring-primary/15"
          />
        </TableCell>
        <TableCell aria-hidden="true" />
      </TableRow>
      {expanded &&
        rows.map((row) => (
          <TableRow key={row.id} className="hover:bg-primary/[0.03]">
            <TableCell className={cn("bg-primary/[0.018] px-4 pl-12 font-medium", row.accent)}>
              {row.indicator}
            </TableCell>
            {MONTH_FIELDS.map((field) => (
              <TableCell key={field} className="bg-primary/[0.018]">
                <Input
                  aria-label={`${field} de ${row.indicator}`}
                  type="text"
                  inputMode="decimal"
                  value={row[field]}
                  onChange={(event) => onChange(row.id, field, event.target.value)}
                  className="h-9 rounded-xl border-primary/20 bg-primary/[0.045] px-2.5 text-right text-sm font-semibold tabular-nums shadow-sm focus-visible:border-primary/50 focus-visible:ring-primary/15"
                />
              </TableCell>
            ))}
            <TableCell className="bg-primary/[0.025]">
              <Input
                aria-label={`Totalizador de ${row.indicator}`}
                type="text"
                inputMode="decimal"
                value={row.totalizer}
                onChange={(event) => onChange(row.id, "totalizer", event.target.value)}
                className="h-9 rounded-xl border-primary/20 bg-primary/[0.045] px-2.5 text-right text-sm font-bold tabular-nums shadow-sm focus-visible:border-primary/50 focus-visible:ring-primary/15"
              />
            </TableCell>
            <TableCell>
              <Input
                aria-label={`Pontos de ${row.indicator}`}
                type="text"
                inputMode="decimal"
                value={row.points}
                onChange={(event) => onChange(row.id, "points", event.target.value)}
                className="h-9 rounded-xl border-primary/20 bg-primary/[0.045] px-2.5 text-right text-sm font-bold tabular-nums shadow-sm focus-visible:border-primary/50 focus-visible:ring-primary/15"
              />
            </TableCell>
            <TableCell>
              <Input
                aria-label={`Faixa de ${row.indicator}`}
                type="text"
                value={row.band}
                onChange={(event) => onChange(row.id, "band", event.target.value)}
                className="h-9 rounded-xl border-primary/20 bg-primary/[0.045] px-2.5 text-left text-sm font-semibold shadow-sm focus-visible:border-primary/50 focus-visible:ring-primary/15"
              />
            </TableCell>
          </TableRow>
        ))}
    </Fragment>
  );
}
