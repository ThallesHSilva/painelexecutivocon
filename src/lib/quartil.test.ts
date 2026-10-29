import test from "node:test";
import assert from "node:assert/strict";
import { quartilEvolutionCounts, type QuartilConsultant, type QuartilMetric } from "./quartil.ts";

function consultant(
  id: string,
  change3: number | null,
  change6: number | null,
  q5Months: number,
): QuartilConsultant {
  const months = ["2026-07", "2026-08", "2026-09"];
  const point = (month: string, quartile: number) => ({
    id,
    name: id,
    partnerId: "p",
    partnerName: "P",
    month,
    tenure: "experienced" as const,
    values: { receita: 0, movel: 0, ftth: 0 },
    quartiles: { receita: quartile, movel: quartile, ftth: quartile } as Record<
      QuartilMetric,
      number
    >,
  });
  const history = months.map((month, index) => point(month, index >= 3 - q5Months ? 5 : 3));
  const changes = (value: number | null) => ({ receita: value, movel: value, ftth: value });
  return {
    ...history[2],
    history,
    comparisons: {
      "3": { month: "2026-07", changes: changes(change3) },
      "6": { month: "2026-04", changes: changes(change6) },
    },
  };
}

test("evolution counts split up, down, stable and ignore missing history", () => {
  const list = [
    consultant("a", 2, 1, 0),
    consultant("b", -1, 0, 0),
    consultant("c", 0, -2, 0),
    consultant("d", null, null, 0),
    consultant("e", 1, null, 3),
  ];
  assert.deepEqual(quartilEvolutionCounts(list, "receita", "3"), {
    up: 2,
    down: 1,
    stable: 1,
    alert: 1,
  });
  assert.deepEqual(quartilEvolutionCounts(list, "receita", "6"), {
    up: 1,
    down: 1,
    stable: 1,
    alert: 1,
  });
});
