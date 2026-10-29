/**
 * Projeção de conversão do simulador de oportunidades, compartilhada entre a página
 * do simulador e o relatório executivo, para que a tabela impressa nunca diverja da tela.
 */

export type OpportunityRow = {
  parceiro: string;
  oportunidades: number;
};

export type ConversionParams = {
  quantityPerCnpj: number;
  conversionRate: number;
  capacityPerDay: number;
  averageTicket: number;
};

export type SimulationEntry = OpportunityRow & {
  quantity: number;
  conversions: number;
  capacity: number;
  revenue: number;
};

/** Mesma chave e mesmo escopo do simulador da página Móvel. */
export const MOBILE_SIMULATOR_STORAGE_KEY = "mapa-parque.mobile-simulators.v1";

/** Mesma chave e mesmo escopo do simulador da página FTTH. */
export const FTTH_SIMULATOR_STORAGE_KEY = "mapa-parque.ftth-simulators.v1";

export const DEFAULT_CONVERSION_PARAMS: ConversionParams = {
  quantityPerCnpj: 2,
  conversionRate: 5,
  capacityPerDay: 20,
  averageTicket: 0,
};

export function simulateConversion(rows: OpportunityRow[], params: ConversionParams) {
  const { quantityPerCnpj, conversionRate, capacityPerDay, averageTicket } = params;
  const simulation: SimulationEntry[] = rows.map((partner) => {
    const quantity = partner.oportunidades * quantityPerCnpj;
    const conversions = quantity * (conversionRate / 100);
    const capacity = capacityPerDay > 0 ? Math.ceil(conversions / capacityPerDay) : 0;
    const revenue = conversions * averageTicket;
    return { ...partner, quantity, conversions, capacity, revenue };
  });
  const total = simulation.reduce(
    (result, partner) => ({
      oportunidades: result.oportunidades + partner.oportunidades,
      quantity: result.quantity + partner.quantity,
      conversions: result.conversions + partner.conversions,
      capacity: result.capacity + partner.capacity,
      revenue: result.revenue + partner.revenue,
    }),
    { oportunidades: 0, quantity: 0, conversions: 0, capacity: 0, revenue: 0 },
  );
  return { simulation, total };
}

function savedNumber(value: unknown, minimum: number, maximum = Infinity) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : undefined;
}

/**
 * Lê os parâmetros que o simulador salvou no navegador (inclusive os nomes legados);
 * o que não estiver salvo ou estiver malformado cai nos padrões do simulador.
 */
export function readSavedConversionParams(storageKey: string): ConversionParams {
  const params = { ...DEFAULT_CONVERSION_PARAMS };
  try {
    const saved = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}") as Record<
      string,
      unknown
    >;
    params.quantityPerCnpj =
      savedNumber(saved.quantityPerCnpj ?? saved.linesPerCnpj, 0) ?? params.quantityPerCnpj;
    params.conversionRate = savedNumber(saved.conversionRate, 0, 100) ?? params.conversionRate;
    params.capacityPerDay =
      savedNumber(saved.capacityPerDay ?? saved.capacityPerPdu, 1) ?? params.capacityPerDay;
    params.averageTicket =
      savedNumber(saved.averageTicket ?? saved.ticketMedio, 0) ?? params.averageTicket;
  } catch {
    // Browser storage unavailable or malformed: keep the simulator defaults.
  }
  return params;
}
