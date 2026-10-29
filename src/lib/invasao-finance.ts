import type { InvasaoDirectorateRow, InvasaoMonthRow } from "./invasao.ts";

export type InvasaoModality = "movel" | "ftth";
/** Prices are stored in integer cents, keyed by month ("AAAA-MM"); null is deliberately not zero. */
export type InvasaoTickets = Record<string, Record<InvasaoModality, number | null>>;
export type InvasaoTicketEdits = Record<string, Partial<Record<InvasaoModality, number | null>>>;

/** Overlay only edited fields on the latest persisted data, never a stale whole-row cache. */
export function mergeInvasaoTicketEdits(
  base: InvasaoTickets,
  edits: InvasaoTicketEdits,
): InvasaoTickets {
  const result = { ...base };
  for (const [directorate, fields] of Object.entries(edits)) {
    const row = { ...(result[directorate] ?? { movel: null, ftth: null }) };
    for (const modality of ["movel", "ftth"] as const) {
      if (fields[modality] !== undefined) row[modality] = fields[modality]!;
    }
    Object.defineProperty(result, directorate, {
      value: row,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return sanitizeInvasaoTickets(result);
}

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const decimal = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const percent = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
export const formatInvasaoCents = (cents: number | null | undefined) =>
  cents == null || !Number.isFinite(cents) ? "—" : money.format(cents / 100);
export const formatTicketInput = (cents: number | null) =>
  cents == null ? "" : decimal.format(cents / 100);
export const formatInvasaoShare = (share: number | null) =>
  share == null || !Number.isFinite(share) ? "—" : percent.format(share);

export function parseTicketCents(input: string): { cents: number | null; invalid: boolean } {
  const text = input.trim().replace(/^R\$\s*/i, "");
  if (!text) return { cents: null, invalid: false };
  let normalized: string;
  if (text.includes(",")) {
    if (!/^(?:\d{1,3}(?:\.\d{3})+|\d+),(?:\d{0,2})$/.test(text))
      return { cents: null, invalid: true };
    normalized = text.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(text)) normalized = text.replace(/\./g, "");
  else if (/^\d+(?:\.\d{0,2})?$/.test(text)) normalized = text;
  else return { cents: null, invalid: true };
  const [whole, fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents >= 0
    ? { cents, invalid: false }
    : { cents: null, invalid: true };
}

function validCents(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function sanitizeInvasaoTickets(value: unknown): InvasaoTickets {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([directorate, entry]) => {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
      const row = entry as Record<string, unknown>;
      return [[directorate, { movel: validCents(row.movel), ftth: validCents(row.ftth) }]];
    }),
  );
}

/**
 * Tickets are a price premise per user, month and modality (the keys of `InvasaoTickets`
 * are months, "AAAA-MM"). They do not depend on the partner selection, so changing the
 * filter or importing a new partner never discards typed values.
 */
export function invasaoTicketStorageKey(identity: string) {
  return `mapa-parque.invasao-tickets.v2:${JSON.stringify([identity])}`;
}

function revenue(altas: number, cents: number | null) {
  if (!Number.isSafeInteger(altas)) return null;
  if (altas === 0) return 0;
  if (cents === null) return null;
  const total = altas * cents;
  return Number.isSafeInteger(total) ? total : null;
}

/**
 * Representatividade de cada Diretoria Habilitador, por modalidade. Sem denominador
 * (modalidade sem altas no mês e recorte) não há percentual: `null`, nunca 0%.
 */
export function invasaoDirectorateShares(rows: InvasaoDirectorateRow[]) {
  const totalMovel = rows.reduce((sum, row) => sum + row.altasMovel, 0);
  const totalFtth = rows.reduce((sum, row) => sum + row.altasFtth, 0);
  return {
    rows: rows.map((row) => ({
      ...row,
      shareMovel: totalMovel && Number.isFinite(totalMovel) ? row.altasMovel / totalMovel : null,
      shareFtth: totalFtth && Number.isFinite(totalFtth) ? row.altasFtth / totalFtth : null,
    })),
    totalMovel,
    totalFtth,
  };
}

/**
 * Ticket e receita estimada por mês do histórico. Receita = altas × ticket (centavos
 * inteiros). Mês sem altas não exige ticket; ticket vazio com altas deixa a receita e o
 * total pendentes (`null`), sem total parcial. One calculation source for the editable
 * page and the read-only executive report.
 */
export function invasaoHistoryFinance(history: InvasaoMonthRow[], tickets: InvasaoTickets) {
  const rows = history.map((row) => {
    const ticketMovelCents = validCents(tickets[row.month]?.movel);
    const ticketFtthCents = validCents(tickets[row.month]?.ftth);
    return {
      ...row,
      ticketMovelCents,
      ticketFtthCents,
      revenueMovelCents: revenue(row.altasMovel, ticketMovelCents),
      revenueFtthCents: revenue(row.altasFtth, ticketFtthCents),
    };
  });
  const sumRevenue = (values: (number | null)[]) => {
    if (values.some((value) => value === null)) return null;
    const total = values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
    return Number.isSafeInteger(total) ? total : null;
  };
  return {
    rows,
    totalMovel: rows.reduce((sum, row) => sum + row.altasMovel, 0),
    totalFtth: rows.reduce((sum, row) => sum + row.altasFtth, 0),
    totalRevenueMovelCents: sumRevenue(rows.map((row) => row.revenueMovelCents)),
    totalRevenueFtthCents: sumRevenue(rows.map((row) => row.revenueFtthCents)),
  };
}
