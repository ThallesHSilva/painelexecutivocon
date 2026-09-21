export type OpportunityFilterRule = {
  column: string;
  selection: string;
};

export type OpportunityFilterGroup = {
  title?: string;
  rules: OpportunityFilterRule[];
};

/**
 * Ajuda comercial dos KPIs de oportunidade.
 *
 * Preserva exatamente o que o negócio aprovou: a coluna do Mapa Parque, os valores
 * selecionados e a combinação entre os filtros. Grupos com título representam
 * públicos somados; dentro de um grupo, as regras se combinam entre si.
 */
export function OpportunityFilterTooltip({ groups }: { groups: OpportunityFilterGroup[] }) {
  return (
    <div className="max-h-[min(20rem,60vh)] space-y-2.5 overflow-y-auto overscroll-contain text-left">
      {groups.map((group, groupIndex) => (
        <div key={`${group.title ?? "filtros"}-${groupIndex}`} className="space-y-1">
          {group.title && (
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {group.title}
            </p>
          )}
          <ul className="space-y-1">
            {group.rules.map((rule) => (
              <li
                key={`${groupIndex}-${rule.column}-${rule.selection}`}
                className="text-xs leading-5 text-foreground"
              >
                <span className="font-semibold">{rule.column}:</span>{" "}
                <span className="text-muted-foreground">{rule.selection}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
