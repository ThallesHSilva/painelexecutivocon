/** Invasão de carteira: altas vendidas fora da carteira do parceiro, por mês e diretoria. */
export type InvasaoRecord = {
  partnerId: string;
  partnerName: string;
  /** Mês de exercício (AAAA-MM), vindo da coluna AnoMês. */
  month: string;
  /** Coluna Diretoria Habilitador. */
  directorate: string;
  altasMovel: number;
  altasFtth: number;
};

export type InvasaoSnapshot = {
  source: { report: string; importedAt: string };
  latestMonth: string;
  months: string[];
  partners: { id: string; name: string }[];
  /** Pares parceiro + mês presentes na base, mesmo quando não houve invasão. */
  periods: { partnerId: string; partnerName: string; month: string }[];
  records: InvasaoRecord[];
};

export type InvasaoDirectorateRow = {
  directorate: string;
  altasMovel: number;
  altasFtth: number;
};

export type InvasaoMonthRow = { month: string; altasMovel: number; altasFtth: number };

/**
 * Altas por mês, em ordem cronológica. Meses da base sem nenhuma alta de invasão entram
 * com zero: o parceiro enviou a base, só não houve venda.
 */
export function summarizeByMonth(records: InvasaoRecord[], months: string[]): InvasaoMonthRow[] {
  const byMonth = new Map<string, InvasaoMonthRow>(
    months.map((month) => [month, { month, altasMovel: 0, altasFtth: 0 }]),
  );
  for (const record of records) {
    const row = byMonth.get(record.month);
    if (!row) continue;
    row.altasMovel += record.altasMovel;
    row.altasFtth += record.altasFtth;
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

/** Soma por Diretoria Habilitador, da maior para a menor quantidade de altas. */
export function summarizeByDirectorate(records: InvasaoRecord[]): InvasaoDirectorateRow[] {
  const byDirectorate = new Map<string, InvasaoDirectorateRow>();
  for (const record of records) {
    const row = byDirectorate.get(record.directorate) ?? {
      directorate: record.directorate,
      altasMovel: 0,
      altasFtth: 0,
    };
    row.altasMovel += record.altasMovel;
    row.altasFtth += record.altasFtth;
    byDirectorate.set(record.directorate, row);
  }
  return [...byDirectorate.values()].sort(
    (a, b) =>
      b.altasMovel + b.altasFtth - (a.altasMovel + a.altasFtth) ||
      a.directorate.localeCompare(b.directorate, "pt-BR"),
  );
}
