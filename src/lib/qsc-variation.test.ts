import test from "node:test";
import assert from "node:assert/strict";
import {
  formatQscDeltaPp,
  previousCompetence,
  qscVariation,
  qscWorsened,
  shortCompetence,
} from "./qsc-variation.ts";
import type { QscMetricPoint, QscMetricSeries } from "./qsc.ts";

const point = (competence: string, value: number | null, available = true): QscMetricPoint => ({
  competence,
  value,
  numerator: 1,
  denominator: 1,
  available,
  zeroPark: false,
  score: null,
  scoreBand: null,
});
const metric = (
  id: string,
  favorableDirection: "up" | "down",
  history: QscMetricPoint[],
  latest = history.at(-1) ?? null,
): QscMetricSeries => ({
  id,
  domain: "fixa",
  label: id,
  formula: "",
  interpretation: "",
  favorableDirection,
  scoreRules: [],
  latest,
  history,
});

test("previous competence crosses the year boundary", () => {
  assert.equal(previousCompetence("2026-09"), "2026-08");
  assert.equal(previousCompetence("2026-01"), "2025-12");
  assert.equal(previousCompetence("invalid"), null);
});

test("a drop is a move against the favorable direction", () => {
  const up = metric("up", "up", [point("2026-08", 0.9), point("2026-09", 0.85)]);
  const down = metric("down", "down", [point("2026-08", 0.02), point("2026-09", 0.03)]);
  assert.equal(qscVariation(up).status, "worse");
  assert.equal(qscVariation(up).deltaPp, -5);
  assert.equal(qscVariation(down).status, "worse");
  assert.equal(qscVariation(down).deltaPp, 1);
});

test("moves toward the favorable direction are improvements, not drops", () => {
  const up = metric("up", "up", [point("2026-08", 0.8), point("2026-09", 0.9)]);
  const churn = metric("churn", "down", [point("2026-08", 0.05), point("2026-09", 0.03)]);
  assert.equal(qscVariation(up).status, "better");
  assert.equal(qscVariation(churn).status, "better");
  assert.deepEqual(qscWorsened([up, churn]), []);
});

test("equal displayed values are stable even with float noise below the shown precision", () => {
  const result = qscVariation(
    metric("stable", "up", [point("2026-08", 0.123456), point("2026-09", 0.12349)]),
  );
  assert.equal(result.status, "stable");
  assert.equal(result.deltaPp, 0);
});

test("missing previous month or missing apuration is unavailable, never a drop", () => {
  // The previous *calendar* month must exist; an older point is not "the month before".
  assert.equal(
    qscVariation(metric("gap", "up", [point("2026-07", 0.9), point("2026-09", 0.5)])).status,
    "unavailable",
  );
  assert.equal(
    qscVariation(metric("na", "up", [point("2026-08", 0.9, false), point("2026-09", 0.5)])).status,
    "unavailable",
  );
  assert.equal(
    qscVariation(metric("null", "up", [point("2026-08", null), point("2026-09", 0.5)])).status,
    "unavailable",
  );
  assert.equal(qscVariation(metric("none", "up", [], null)).status, "unavailable");
});

test("an indicator that closes late is compared at its own closed month", () => {
  // Set/26 has no apuration yet (denominator 0): the closed month is Ago/26 vs Jul/26.
  const late = metric(
    "early-churn",
    "down",
    [point("2026-07", 0.02), point("2026-08", 0.05), point("2026-09", null, false)],
    point("2026-09", null, false),
  );
  const result = qscVariation(late);
  assert.equal(result.current?.competence, "2026-08");
  assert.equal(result.previous?.competence, "2026-07");
  assert.equal(result.status, "worse");
  assert.equal(result.deltaPp, 3);
  assert.equal(shortCompetence("2026-08"), "ago/26");
  assert.equal(shortCompetence("x"), "—");
});

test("a real zero stays a value: falling to zero is a drop", () => {
  const result = qscVariation(metric("zero", "up", [point("2026-08", 0.4), point("2026-09", 0)]));
  assert.equal(result.status, "worse");
  assert.equal(result.deltaPp, -40);
});

test("worsened list is ordered by the largest move and ignores the rest", () => {
  const small = metric("a-small", "up", [point("2026-08", 0.5), point("2026-09", 0.49)]);
  const big = metric("b-big", "down", [point("2026-08", 0.1), point("2026-09", 0.3)]);
  const fine = metric("c-fine", "up", [point("2026-08", 0.5), point("2026-09", 0.6)]);
  assert.deepEqual(
    qscWorsened([small, fine, big]).map((item) => item.metric.id),
    ["b-big", "a-small"],
  );
});

test("delta text has an explicit sign, comma decimal and unit", () => {
  assert.equal(formatQscDeltaPp(-5).replace(/\s/g, " "), "-5,00 p.p.");
  assert.equal(formatQscDeltaPp(1.25).replace(/\s/g, " "), "+1,25 p.p.");
  assert.equal(formatQscDeltaPp(0).replace(/\s/g, " "), "0,00 p.p.");
  assert.equal(formatQscDeltaPp(null), "—");
});
