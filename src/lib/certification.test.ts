import test from "node:test";
import assert from "node:assert/strict";
import {
  INITIAL_CYCLES,
  calculateCertificationCycle,
  parseCertificationPreview,
  LOCATION_ROW_ID,
  LEGACY_LOCATION_ROW_ID,
} from "./certification.ts";

test("saved simulation is recalculated, ignoring stale totalizer, points and band", () => {
  const input = structuredClone(INITIAL_CYCLES.current);
  input.breakdown[0].jan = "65.000,00";
  input.summary.totalizer = "999.999,00";
  input.summary.points = "999.999";
  input.summary.band = "FAIXA 99";
  input.oneShot.jan = "204.000,00";
  input.ftthPhysical.jan = "60";
  input.newProductsRevenue.jan = "11.200,00";
  input.revenuePerFdv.jan = "1.200,00";
  input.qsc.rows[0].jan = "90";
  const result = calculateCertificationCycle(input);
  assert.equal(result.summary.totalizer, "65.000,00");
  assert.equal(result.summary.points, "5.200");
  assert.equal(result.qscRows[0].points, "1.000");
  assert.equal(result.totalPoints, 7900);
  assert.equal(result.stone.stone, "DIAMANTE");
  assert.equal(input.summary.points, "999.999");
});

test("a true zero month participates in the mean, empty months do not", () => {
  const input = structuredClone(INITIAL_CYCLES.current);
  input.breakdown[0].jan = "80.000,00";
  input.breakdown[0].feb = "0";
  input.qsc.rows[0].jan = "90";
  input.qsc.rows[0].feb = "0";
  const result = calculateCertificationCycle(input);
  assert.equal(result.summary.totalizer, "40.000,00");
  assert.equal(result.qscRows[0].totalizer, "45");
  assert.equal(result.qscRows[0].points, "0");
  assert.equal(result.qscRows[1].totalizer, "");
});

test("invalid or missing stored payload never substitutes the closed-cycle example", () => {
  assert.equal(parseCertificationPreview(null), null);
  assert.equal(parseCertificationPreview({ summary: {}, breakdown: [], qsc: {} }), null);
  const input = structuredClone(INITIAL_CYCLES.current);
  assert.ok(parseCertificationPreview(input));
  input.oneShot.jan = "not a number";
  assert.equal(parseCertificationPreview(input), null);
});

test("legacy equipment rows are merged exactly once without losing amounts", () => {
  const input = structuredClone(INITIAL_CYCLES.current);
  const row = input.breakdown.find((item) => item.id === LOCATION_ROW_ID)!;
  row.jan = "100,00";
  input.breakdown.push({ ...row, id: LEGACY_LOCATION_ROW_ID, jan: "50,00" });
  const parsed = parseCertificationPreview(input)!;
  assert.equal(parsed.breakdown.filter((item) => item.id === LOCATION_ROW_ID).length, 1);
  assert.equal(
    parsed.breakdown.some((item) => item.id === LEGACY_LOCATION_ROW_ID),
    false,
  );
  assert.equal(calculateCertificationCycle(parsed).summary.totalizer, "150,00");
});
