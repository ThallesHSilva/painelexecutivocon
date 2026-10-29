import test from "node:test";
import assert from "node:assert/strict";
import { reportChunks, invasaoReportSummary } from "./report-data.ts";
import type { InvasaoSnapshot } from "./invasao.ts";

test("pagination keeps every row, in order, including a final partial sheet", () => {
  const rows = Array.from({ length: 49 }, (_, index) => index);
  const chunks = reportChunks(rows, 12);
  assert.deepEqual(
    chunks.map((part) => part.length),
    [12, 12, 12, 12, 1],
  );
  assert.deepEqual(chunks.flat(), rows);
  assert.deepEqual(reportChunks([]), [[]]);
  assert.throws(() => reportChunks(rows, 0));
});

test("invasao latest-month cards do not sum history; loaded month without sales stays zero", () => {
  const snapshot: InvasaoSnapshot = {
    source: { report: "fixture", importedAt: "" },
    latestMonth: "2026-08",
    months: ["2026-09", "2026-07", "2026-08"],
    partners: [],
    periods: [],
    records: [
      {
        partnerId: "a",
        partnerName: "A",
        month: "2026-07",
        directorate: "Inbound",
        altasMovel: 4,
        altasFtth: 2,
      },
      {
        partnerId: "a",
        partnerName: "A",
        month: "2026-09",
        directorate: "Inbound",
        altasMovel: 50,
        altasFtth: 1,
      },
      {
        partnerId: "a",
        partnerName: "A",
        month: "2026-09",
        directorate: "Consultivo",
        altasMovel: 28,
        altasFtth: 4,
      },
    ],
  };
  const result = invasaoReportSummary(snapshot);
  assert.equal(result.latestMonth, "2026-09");
  assert.deepEqual(result.monthTotal, { altasMovel: 78, altasFtth: 5 });
  assert.deepEqual(result.periodTotal, { altasMovel: 82, altasFtth: 7 });
  assert.deepEqual(result.history[1], { month: "2026-08", altasMovel: 0, altasFtth: 0 });
  assert.deepEqual(
    result.directorates.map((row) => row.directorate),
    ["Inbound", "Consultivo"],
  );
  assert.deepEqual(snapshot.months, ["2026-09", "2026-07", "2026-08"]);
});

test("empty imported scope is distinct from an observed month with zero altas", () => {
  const base: InvasaoSnapshot = {
    source: { report: "fixture", importedAt: "" },
    latestMonth: "",
    months: [],
    partners: [],
    periods: [],
    records: [],
  };
  assert.equal(invasaoReportSummary(base).latestMonth, "");
  assert.deepEqual(invasaoReportSummary({ ...base, months: ["2026-10"] }).history, [
    { month: "2026-10", altasMovel: 0, altasFtth: 0 },
  ]);
});
