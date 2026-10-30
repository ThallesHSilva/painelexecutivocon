import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SIMULATOR_SETTINGS,
  readSavedConversionParams,
  readSavedSimulator,
  savePartnerSettings,
  simulateConversion,
} from "./opportunity-simulation.ts";

const KEY = "test.simulator";

function stubStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
      },
    },
  });
}

test("each partner is simulated with its own parameters", () => {
  const rows = [
    { parceiro: "A", oportunidades: 100 },
    { parceiro: "B", oportunidades: 100 },
  ];
  const { simulation, total } = simulateConversion(rows, (parceiro) => ({
    quantityPerCnpj: 1,
    conversionRate: parceiro === "A" ? 10 : 50,
    capacityPerDay: 5,
    averageTicket: 2,
  }));
  assert.deepEqual(
    simulation.map((row) => row.conversions),
    [10, 50],
  );
  assert.deepEqual(
    simulation.map((row) => row.revenue),
    [20, 100],
  );
  assert.equal(total.conversions, 60);
});

test("a partner's settings are saved without touching the others", () => {
  stubStorage();
  const a = { ...DEFAULT_SIMULATOR_SETTINGS, conversionRate: 12 };
  const b = { ...DEFAULT_SIMULATOR_SETTINGS, conversionRate: 40, averageTicket: 55 };
  savePartnerSettings(KEY, "A", a);
  savePartnerSettings(KEY, "B", b);

  const saved = readSavedSimulator(KEY);
  assert.deepEqual(saved.partners.A, a);
  assert.deepEqual(saved.partners.B, b);

  const resolve = readSavedConversionParams(KEY);
  assert.equal(resolve("A").conversionRate, 12);
  assert.equal(resolve("B").averageTicket, 55);
  assert.equal(resolve("C").conversionRate, DEFAULT_SIMULATOR_SETTINGS.conversionRate);
});

test("the former global settings still apply to partners not yet filled in", () => {
  stubStorage({
    [KEY]: JSON.stringify({
      linesPerCnpj: 3,
      conversionRate: 8,
      capacityPerPdu: 10,
      ticketMedio: 70,
    }),
  });
  savePartnerSettings(KEY, "A", { ...DEFAULT_SIMULATOR_SETTINGS, conversionRate: 20 });

  const resolve = readSavedConversionParams(KEY);
  assert.equal(resolve("A").conversionRate, 20);
  const other = resolve("Outro");
  assert.equal(other.quantityPerCnpj, 3);
  assert.equal(other.conversionRate, 8);
  assert.equal(other.capacityPerDay, 10);
  assert.equal(other.averageTicket, 70);
});

test("malformed storage falls back to defaults", () => {
  stubStorage({ [KEY]: "{not json" });
  assert.deepEqual(readSavedSimulator(KEY), {
    defaults: DEFAULT_SIMULATOR_SETTINGS,
    partners: {},
  });
});
