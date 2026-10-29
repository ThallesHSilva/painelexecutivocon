import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeInvasaoTicketEdits,
  parseTicketCents,
  invasaoDirectorateShares,
  invasaoHistoryFinance,
  formatInvasaoCents,
  formatInvasaoShare,
  invasaoTicketStorageKey,
  sanitizeInvasaoTickets,
} from "./invasao-finance.ts";

test("editing one month preserves concurrent persisted changes and unsaved edits", () => {
  const storage = {
    "2026-08": { movel: 1000, ftth: 2000 },
    "2026-09": { movel: 3000, ftth: 4000 },
  };
  const merged = mergeInvasaoTicketEdits(storage, {
    "2026-08": { movel: 5000 },
    "2026-10": { ftth: 6000 },
  });
  assert.deepEqual(merged, {
    "2026-08": { movel: 5000, ftth: 2000 },
    "2026-09": { movel: 3000, ftth: 4000 },
    "2026-10": { movel: null, ftth: 6000 },
  });
  assert.equal(storage["2026-08"].movel, 1000);
  // Clearing a ticket is an explicit edit, not a missing field.
  assert.equal(
    mergeInvasaoTicketEdits(storage, { "2026-09": { ftth: null } })["2026-09"].ftth,
    null,
  );
});

test("manual prices retain cents and accept Brazilian and decimal-dot entry", () => {
  for (const [text, cents] of [
    ["", null],
    ["0", 0],
    ["49,90", 4990],
    ["49.90", 4990],
    ["R$ 1.234,56", 123456],
    ["1.234", 123400],
    ["12,", 1200],
    ["12,3", 1230],
  ] as const) {
    assert.deepEqual(parseTicketCents(text), { cents, invalid: false }, text);
  }
  for (const text of ["-1", "abc", "Infinity", "1e3", "49,999", "1..00", "9007199254740991,99"]) {
    assert.deepEqual(parseTicketCents(text), { cents: null, invalid: true }, text);
  }
  assert.equal(formatInvasaoCents(4990).replace(/\s/g, " "), "R$ 49,90");
});

const rows = [
  { directorate: "Inbound", altasMovel: 50, altasFtth: 1 },
  { directorate: "Consultivo", altasMovel: 28, altasFtth: 4 },
  { directorate: "Hunter B2C", altasMovel: 17, altasFtth: 5 },
  { directorate: "Canais Digitais", altasMovel: 14, altasFtth: 0 },
  { directorate: "Outbound EPS", altasMovel: 2, altasFtth: 1 },
];
const month = (key: string, altasMovel: number, altasFtth: number) => ({
  month: key,
  altasMovel,
  altasFtth,
});

test("directorate table shows only altas and percentages, per modality", () => {
  const result = invasaoDirectorateShares(rows);
  assert.equal(result.totalMovel, 111);
  assert.equal(result.totalFtth, 11);
  assert.equal(formatInvasaoShare(result.rows[0].shareMovel), "45,05%");
  assert.equal(formatInvasaoShare(result.rows[0].shareFtth), "9,09%");
  assert.equal(formatInvasaoShare(result.rows[3].shareFtth), "0,00%");
  assert.ok(!("revenueMovelCents" in result.rows[0]));
  assert.ok(!("ticketMovelCents" in result.rows[0]));
  const before = structuredClone(rows);
  invasaoDirectorateShares(rows);
  assert.deepEqual(rows, before);
});

test("modality without volume has no percentage, never 0%", () => {
  const result = invasaoDirectorateShares([{ directorate: "A", altasMovel: 0, altasFtth: 0 }]);
  assert.equal(result.rows[0].shareMovel, null);
  assert.equal(result.rows[0].shareFtth, null);
  assert.equal(formatInvasaoShare(null), "—");
});

test("history revenue is altas x monthly ticket in exact cents", () => {
  const result = invasaoHistoryFinance([month("2026-08", 40, 2), month("2026-09", 111, 11)], {
    "2026-08": { movel: 4990, ftth: 8990 },
    "2026-09": { movel: 5000, ftth: 9000 },
  });
  assert.equal(result.rows[0].revenueMovelCents, 199600);
  assert.equal(result.rows[1].revenueMovelCents, 555000);
  assert.equal(result.rows[1].revenueFtthCents, 99000);
  assert.equal(result.totalMovel, 151);
  assert.equal(result.totalFtth, 13);
  // Each month is priced by its own ticket, never by one average.
  assert.equal(result.totalRevenueMovelCents, 199600 + 555000);
  assert.equal(result.totalRevenueFtthCents, 17980 + 99000);
  assert.equal(formatInvasaoCents(4990).replace(/\s/g, " "), "R$ 49,90");
});

test("unfilled ticket is not zero and totals never present partial revenue", () => {
  const result = invasaoHistoryFinance([month("2026-08", 40, 2), month("2026-09", 10, 1)], {
    "2026-09": { movel: 0, ftth: 10000 },
  });
  assert.equal(result.rows[1].revenueMovelCents, 0);
  assert.equal(result.rows[0].revenueMovelCents, null);
  assert.equal(result.totalRevenueMovelCents, null);
  assert.equal(result.totalRevenueFtthCents, null);
  assert.equal(formatInvasaoCents(null), "—");
});

test("a month without altas needs no ticket", () => {
  const result = invasaoHistoryFinance([month("2026-08", 0, 0), month("2026-09", 3, 0)], {
    "2026-09": { movel: 1000, ftth: null },
  });
  assert.equal(result.rows[0].revenueMovelCents, 0);
  assert.equal(result.totalRevenueMovelCents, 3000);
  assert.equal(result.totalRevenueFtthCents, 0);
});

test("invalid counts and unsafe revenue are unavailable, never silently rounded", () => {
  assert.equal(
    invasaoHistoryFinance([month("2026-09", 1.5, 3)], { "2026-09": { movel: 1000, ftth: 10 } })
      .totalRevenueMovelCents,
    null,
  );
  assert.equal(
    invasaoHistoryFinance([month("2026-09", 2, 3)], {
      "2026-09": { movel: Number.MAX_SAFE_INTEGER, ftth: 10 },
    }).totalRevenueMovelCents,
    null,
  );
  assert.equal(
    invasaoHistoryFinance([month("2026-09", 1, 3)], { "2026-09": { movel: 10, ftth: 10 } })
      .totalRevenueFtthCents,
    30,
  );
});

test("stored prices validate cents, preserve zero, and do not mutate inputs", () => {
  const input = { A: { movel: 0, ftth: -10 }, B: { movel: 10.5, ftth: "500" }, C: null };
  assert.deepEqual(sanitizeInvasaoTickets(input), {
    A: { movel: 0, ftth: null },
    B: { movel: null, ftth: null },
  });
  const history = [month("2026-09", 5, 1)];
  const tickets = { "2026-09": { movel: 100, ftth: 200 } };
  const before = structuredClone({ history, tickets });
  invasaoHistoryFinance(history, tickets);
  assert.deepEqual({ history, tickets }, before);
});

test("storage keys isolate users and do not depend on month or partner selection", () => {
  assert.equal(invasaoTicketStorageKey("1"), invasaoTicketStorageKey("1"));
  assert.notEqual(invasaoTicketStorageKey("1"), invasaoTicketStorageKey("2"));
  assert.match(invasaoTicketStorageKey("1"), /invasao-tickets\.v2:/);
});
