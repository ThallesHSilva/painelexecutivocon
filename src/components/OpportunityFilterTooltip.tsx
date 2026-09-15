export type OpportunityFilterRule = {
  column: string;
  selection: string;
};

export type OpportunityFilterGroup = {
  title?: string;
  rules: OpportunityFilterRule[];
};

export function OpportunityFilterTooltip({ groups }: { groups: OpportunityFilterGroup[] }) {
  return (
    <div className="max-h-72 w-[min(22rem,calc(100vw-2rem))] space-y-3 overflow-y-auto py-1 text-left">
      {groups.map((group, groupIndex) => (
        <div key={`${group.title ?? "filtros"}-${groupIndex}`} className="space-y-1.5">
          {group.title && <p className="font-semibold">{group.title}</p>}
          <ul className="list-disc space-y-1 pl-4">
            {group.rules.map((rule) => (
              <li key={`${groupIndex}-${rule.column}-${rule.selection}`}>
                <span className="font-semibold">{rule.column}:</span> {rule.selection}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
