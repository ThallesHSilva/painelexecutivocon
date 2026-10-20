import assert from "node:assert/strict";
import test from "node:test";
import {
  buildQscDomainHistory,
  qscDomainHistoryResult,
  qscSemesterValues,
} from "./qsc-domain-history.ts";
import type { QscPoint } from "./snapshot-types.ts";

const months = ["2026-07", "2026-08", "2026-09"];
function metric(
  id: string,
  score: number | null,
  competence = months[0],
  overrides: Partial<QscPoint> = {},
) {
  return {
    id,
    domain: "movel" as const,
    scoreRules: [{ start: 0, end: 100, score: 30, band: "1" }],
    latest: {
      competence,
      value: 0.5,
      numerator: 1,
      denominator: 2,
      available: true,
      zeroPark: false,
      score,
      scoreBand: "1",
      ...overrides,
    },
  };
}
const build = (scopes: Parameters<typeof buildQscDomainHistory>[0], selected = ["a", "b"]) =>
  buildQscDomainHistory(scopes, selected, months, months[2]);

test("averages partner domain totals, then averages available months (round before rating)", () => {
  const result = build([
    { id: "a", metrics: [metric("x", 30), metric("y", 20), metric("x", 0, months[1])] },
    { id: "b", metrics: [metric("x", 10), metric("y", 10)] },
    { id: "__all__", metrics: [metric("forged", 988)] },
  ]);
  assert.deepEqual(result.find((s) => s.domain === "movel")?.history, [
    { competence: months[0], score: 35, partnerCount: 2 },
    { competence: months[1], score: 0, partnerCount: 1 },
    { competence: months[2], score: null, partnerCount: 0 },
  ]);
  assert.deepEqual(qscSemesterValues("movel", result, months), {
    values: [35, 0, null],
    availableCount: 2,
    totalizer: 18,
  });
  assert.equal(
    qscSemesterValues(
      "movel",
      [{ domain: "movel", history: [{ competence: months[0], score: 89.5, partnerCount: 1 }] }],
      months,
    ).totalizer,
    90,
  );
});

test("does not average KPI components with different partner denominators", () => {
  const result = build([
    { id: "a", metrics: [metric("x", 30), metric("y", 10)] },
    { id: "b", metrics: [metric("x", 10)] },
  ]);
  assert.equal(result[2].history[0].score, 25);
});

test("authorization, missing scopes, old-only metrics, and future cutoff", () => {
  const scopes = [
    { id: "a", metrics: [metric("old-only", 20), metric("future", 30, "2026-10")] },
    { id: "b", metrics: [metric("x", 10)] },
  ];
  assert.equal(build(scopes, ["a"])[2].history[0].score, 20);
  assert.equal(build(scopes, ["b", "missing"])[2].history[0].partnerCount, 1);
  assert.equal(build(scopes, [])[2].history[0].score, null);
  assert.equal(
    buildQscDomainHistory(scopes, ["a"], [...months, "2026-10"], months[2])[2].history.length,
    3,
  );
  assert.deepEqual(qscSemesterValues("movel", undefined, months), {
    values: [null, null, null],
    availableCount: 0,
    totalizer: null,
  });
});

test("accepts stored nullable points and skips unsupported domains", () => {
  const result = build([
    {
      id: "a",
      metrics: [
        { ...metric("null-latest", 20), latest: null },
        { ...metric("unsupported", 20), domain: "unknown" },
        metric("nullable-base", 10, months[0], { numerator: null, denominator: null }),
      ],
    },
  ]);
  assert.equal(result[2].history[0].score, 10);
  assert.equal(result[2].history[0].partnerCount, 1);
});

test("retains zero and negative scores, excludes missing, zero park, null and nonfinite", () => {
  const result = build([
    {
      id: "a",
      metrics: [
        metric("zero", 0),
        metric("negative", -10),
        metric("missing", 30, months[0], { available: false }),
        metric("park", 30, months[0], { zeroPark: true }),
        metric("null", null),
        metric("nan", NaN),
        metric("infinity", Infinity),
      ],
    },
  ]);
  assert.equal(result[2].history[0].score, -10);
  assert.equal(result[2].history[0].partnerCount, 1);
});

test("deduplicates identical points, rejects conflicting duplicates and corrupted individual scores", () => {
  const point = metric("x", 20);
  assert.equal(
    build([{ id: "a", metrics: [point, { ...point, latest: { ...point.latest } }] }])[2].history[0]
      .score,
    20,
  );
  assert.throws(
    () => build([{ id: "a", metrics: [point, metric("x", 10)] }]),
    /duplicado conflitante.*a, x, 2026-07/,
  );
  assert.throws(
    () => build([{ id: "a", metrics: [metric("x", 988)] }]),
    /acima do máximo.*a, x, 2026-07/,
  );
  assert.equal(
    build([{ id: "a", metrics: [{ ...metric("no-rules", 40), scoreRules: [] }] }])[2].history[0]
      .score,
    40,
  );
});

test("invalid history is isolated from the rest of the API payload", (context) => {
  const log = context.mock.method(console, "error", () => {});
  const point = metric("x", 20);
  for (const metrics of [[metric("x", 988)], [point, metric("x", 10)]]) {
    const result = qscDomainHistoryResult([{ id: "a", metrics }], ["a"], months, months[2]);
    assert.deepEqual(result, { domainHistory: [], domainHistoryUnavailable: true });
    assert.equal(JSON.stringify(result).includes("988"), false);
  }
  assert.equal(log.mock.callCount(), 2);
  assert.deepEqual(
    qscDomainHistoryResult([{ id: "a", metrics: [point] }], ["a"], months, months[2]),
    {
      domainHistory: build([{ id: "a", metrics: [point] }], ["a"]),
      domainHistoryUnavailable: false,
    },
  );
});

test("reference scores from the local July–September snapshot retain semester totals", () => {
  // Anonymized KPI components from the local snapshot; no dependency on mutable upload files.
  const components = (domain: "carteira" | "fixa" | "movel", month: string, scores: number[]) =>
    scores.map((score, index) => ({ ...metric(`${domain}-${index}`, score, month), domain }));
  const scopes = [
    {
      id: "a",
      metrics: components("carteira", months[2], [10, 10, 20, 25, 7, 0, 7, 0]),
    },
    {
      id: "b",
      metrics: [
        ...components("carteira", months[0], [10, 0, 20, 0, 7, 0, 10, 0]),
        ...components("carteira", months[1], [10, 0, 14, 0, 7, 0, 10, 0]),
        ...components("fixa", months[0], [15, 20, 20, 0, 20, 0]),
        ...components("fixa", months[1], [15, 20, 20, 0, 0, 20]),
        ...components("movel", months[0], [30, 20, 15, 0, 14]),
        ...components("movel", months[1], [18, 14, 15, 10, 0]),
      ],
    },
  ];
  const all = build(scopes);
  assert.deepEqual(
    ["carteira", "fixa", "movel"].map(
      (domain) => qscSemesterValues(domain as "carteira" | "fixa" | "movel", all, months).totalizer,
    ),
    [56, 75, 68],
  );
  assert.equal(qscSemesterValues("carteira", build(scopes, ["b"]), months).totalizer, 44);
});

test("negative fractional semester averages display zero without a minus sign", () => {
  assert.equal(
    Object.is(
      qscSemesterValues(
        "movel",
        [{ domain: "movel", history: [{ competence: months[0], score: -0.4, partnerCount: 1 }] }],
        months,
      ).totalizer,
      0,
    ),
    true,
  );
});
