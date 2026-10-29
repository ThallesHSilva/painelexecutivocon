import test from "node:test";
import assert from "node:assert/strict";
import { reportChunks, invasaoReportSummary, layoutTowerPages } from "./report-data.ts";
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

const unit = (id: string, compact = true, beforePortability = false) => ({
  id,
  compact,
  beforePortability,
});
const shape = (items: ReturnType<typeof layoutTowerPages<ReturnType<typeof unit>>>) =>
  items.map((item) =>
    item.kind === "portability" ? "PORT" : item.units.map((u) => u.id).join("+"),
  );

test("towers: compact ones pair two per sheet and portability sits before Banda Larga", () => {
  const items = layoutTowerPages([
    unit("a"),
    unit("b"),
    unit("c"),
    unit("d"),
    unit("banda", true, true),
    unit("e"),
    unit("f"),
  ]);
  // Portability interrupts pairing: c+d stay together, Banda Larga starts a new pair.
  assert.deepEqual(shape(items), ["a+b", "c+d", "PORT", "banda+e", "f"]);
});

test("towers: an odd compact tower before portability stays alone, never joins it", () => {
  assert.deepEqual(
    shape(layoutTowerPages([unit("a"), unit("b"), unit("c"), unit("banda", true, true)])),
    ["a+b", "c", "PORT", "banda"],
  );
});

test("towers: a large tower takes its own sheet and breaks pairing", () => {
  assert.deepEqual(shape(layoutTowerPages([unit("a"), unit("big", false), unit("b"), unit("c")])), [
    "a",
    "big",
    "b+c",
    "PORT",
  ]);
});

test("towers: without Banda Larga portability closes the chapter; every tower is kept in order", () => {
  const units = [unit("a"), unit("b"), unit("c")];
  const items = layoutTowerPages(units);
  assert.deepEqual(shape(items), ["a+b", "c", "PORT"]);
  assert.deepEqual(
    items.flatMap((item) => (item.kind === "towers" ? item.units.map((u) => u.id) : [])),
    ["a", "b", "c"],
  );
  assert.deepEqual(shape(layoutTowerPages([])), ["PORT"]);
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
