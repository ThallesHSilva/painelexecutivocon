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

/** Parâmetros únicos para todos os parceiros, ou um resolvedor por parceiro. */
export type ConversionParamsSource = ConversionParams | ((parceiro: string) => ConversionParams);

export function simulateConversion(rows: OpportunityRow[], params: ConversionParamsSource) {
  const simulation: SimulationEntry[] = rows.map((partner) => {
    const { quantityPerCnpj, conversionRate, capacityPerDay, averageTicket } =
      typeof params === "function" ? params(partner.parceiro) : params;
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

/** Parâmetros completos de um parceiro: conversão mais a média de altas dos qualificados. */
export type PartnerSimulatorSettings = ConversionParams & { averageActivations: number };

export const DEFAULT_SIMULATOR_SETTINGS: PartnerSimulatorSettings = {
  ...DEFAULT_CONVERSION_PARAMS,
  averageActivations: 1,
};

/**
 * Lê um conjunto de parâmetros salvo (inclusive os nomes legados da página Móvel);
 * o que faltar ou estiver malformado cai em `fallback`.
 */
function readSettings(raw: unknown, fallback: PartnerSimulatorSettings): PartnerSimulatorSettings {
  const saved = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    quantityPerCnpj:
      savedNumber(saved.quantityPerCnpj ?? saved.linesPerCnpj, 0) ?? fallback.quantityPerCnpj,
    conversionRate: savedNumber(saved.conversionRate, 0, 100) ?? fallback.conversionRate,
    capacityPerDay:
      savedNumber(saved.capacityPerDay ?? saved.capacityPerPdu, 1) ?? fallback.capacityPerDay,
    averageTicket:
      savedNumber(saved.averageTicket ?? saved.ticketMedio, 0) ?? fallback.averageTicket,
    averageActivations: savedNumber(saved.averageActivations, 1) ?? fallback.averageActivations,
  };
}

function readStorageObject(storageKey: string): Record<string, unknown> {
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}");
    return saved && typeof saved === "object" ? (saved as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export type SavedSimulator = {
  /** Valor de quem ainda não tem parâmetros próprios: o salvo no formato antigo, global. */
  defaults: PartnerSimulatorSettings;
  partners: Record<string, PartnerSimulatorSettings>;
};

/**
 * Lê o que o simulador salvou no navegador. Cada parceiro tem o seu próprio conjunto
 * em `partners`; os parâmetros globais do formato anterior continuam valendo para o
 * parceiro que ainda não foi preenchido, então nada do que já estava salvo se perde.
 */
export function readSavedSimulator(
  storageKey: string,
  baseDefaults: PartnerSimulatorSettings = DEFAULT_SIMULATOR_SETTINGS,
): SavedSimulator {
  const stored = readStorageObject(storageKey);
  const defaults = readSettings(stored, baseDefaults);
  const rawPartners =
    stored.partners && typeof stored.partners === "object"
      ? (stored.partners as Record<string, unknown>)
      : {};
  const partners: Record<string, PartnerSimulatorSettings> = {};
  for (const [parceiro, raw] of Object.entries(rawPartners)) {
    partners[parceiro] = readSettings(raw, defaults);
  }
  return { defaults, partners };
}

/**
 * Grava os parâmetros de um parceiro na hora. Relê o armazenamento antes de gravar para
 * não apagar o que outro parceiro (ou outra aba) acabou de salvar, e preserva os
 * parâmetros globais antigos.
 */
export function savePartnerSettings(
  storageKey: string,
  parceiro: string,
  settings: PartnerSimulatorSettings,
) {
  try {
    const stored = readStorageObject(storageKey);
    const partners =
      stored.partners && typeof stored.partners === "object"
        ? (stored.partners as Record<string, unknown>)
        : {};
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ ...stored, partners: { ...partners, [parceiro]: settings } }),
    );
  } catch {
    // Keep the simulator usable when browser storage is unavailable.
  }
}

/** Resolvedor por parceiro para o relatório executivo: mesmos parâmetros da tela. */
export function readSavedConversionParams(
  storageKey: string,
): (parceiro: string) => ConversionParams {
  const { defaults, partners } = readSavedSimulator(storageKey);
  return (parceiro) => (Object.hasOwn(partners, parceiro) ? partners[parceiro] : defaults);
}
