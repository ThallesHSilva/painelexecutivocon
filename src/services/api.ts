// Central service layer. Simulates fetch to the future backend.
// All functions return processed data ready to render.

import {
  PARTNERS,
  PARTNER_METRICS,
  PORTFOLIO,
  META,
  aggregate,
  type Partner,
  type PortfolioRow,
} from "@/mocks/data";
import type { QscApiResponse } from "@/lib/qsc";
import type { MapaScope, MapaSnapshot } from "@/lib/snapshot-types";

const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms));

async function fetchMapaSnapshot() {
  const response = await fetch("/api/data/mapa", { cache: "no-store" });
  if (!response.ok) throw new Error("Não foi possível carregar o Mapa Parque.");
  return response.json() as Promise<MapaSnapshot>;
}

function scope(ids: string[], partners: Partner[] = PARTNERS) {
  const availableIds = partners.map((partner) => partner.id);
  const validIds = ids.filter((id) => availableIds.includes(id));
  return validIds.length ? validIds : availableIds;
}

function selectedMapaScopes(snapshot: MapaSnapshot, ids: string[]) {
  return snapshot.partners.flatMap((partner) => {
    const partnerScope = snapshot.scopes[partner.id as keyof typeof snapshot.scopes] as
      MapaScope | undefined;
    return ids.includes(partner.id) && partnerScope ? [{ partner, scope: partnerScope }] : [];
  });
}

function sumMapa<T>(rows: { scope: MapaScope }[], select: (scope: MapaScope) => T) {
  return rows.reduce((total, row) => total + Number(select(row.scope) ?? 0), 0);
}

function mergeMapaRows<T extends Record<string, unknown>>(
  rows: { scope: MapaScope }[],
  select: (scope: MapaScope) => T[],
  key: keyof T,
  values: (keyof T)[],
) {
  const merged = new Map<string, T>();
  for (const row of rows) {
    for (const item of select(row.scope)) {
      const id = String(item[key]);
      const current = merged.get(id) ?? ({ ...item } as T);
      for (const field of values) {
        current[field] = (Number(merged.has(id) ? current[field] : 0) +
          Number(item[field] ?? 0)) as T[keyof T];
      }
      merged.set(id, current);
    }
  }
  return [...merged.values()];
}

export async function fetchPartners(): Promise<Partner[]> {
  const snapshot = await fetchMapaSnapshot();
  return snapshot.partners;
}

export async function fetchDashboard(partnerIds: string[]) {
  const snapshot = await fetchMapaSnapshot();
  const ids = scope(partnerIds, snapshot.partners);
  const selected = selectedMapaScopes(snapshot, ids);
  const total = <T>(select: (scope: MapaScope) => T) => sumMapa(selected, select);
  const porTipo = mergeMapaRows(selected, (item) => item.breakdowns.byType, "tipo", ["valor"]);
  const porParceiro = selected.map(({ partner, scope: partnerScope }) => ({
    partnerId: partner.id,
    parceiro: partner.name,
    oportunidades: partnerScope.opportunities.uniqueCnpjWithOpportunity,
  }));
  const geo = mergeMapaRows(selected, (item) => item.breakdowns.byCity, "cidade", [
    "records",
    "opportunities",
  ]).map((item) => ({
    cidade: item.cidade,
    total: item.opportunities,
  }));
  const categorias = mergeMapaRows(selected, (item) => item.breakdowns.byCategory, "categoria", [
    "valor",
  ]).sort((left, right) => Number(right.valor) - Number(left.valor));
  const allCnpj = total((item) => item.totals.allCnpj);
  const opportunityCnpj = total((item) => item.opportunities.uniqueCnpjWithOpportunity);
  const destaques = [
    {
      titulo: "CNPJs com REC_MOVEL",
      valor: total((item) => item.opportunities.mobile),
      hint: "REC_MOVEL com Aquisição ou Winback",
    },
    {
      titulo: "Oportunidades de FTTH",
      valor: total((item) => item.opportunities.ftth),
      hint: "Regra comercial de FTTH",
    },
    {
      titulo: "Oferta Digital",
      valor: total((item) => item.opportunities.digital1),
      hint: "Campo DIGITAL_1 preenchido",
    },
    {
      titulo: "Múltiplas oportunidades",
      valor: total((item) => item.opportunities.multipleOpportunities),
      hint: "2 ou mais regras atendidas",
    },
    {
      titulo: "CNPJs sem oportunidade",
      valor: total((item) => item.opportunities.recordsWithoutOpportunity),
      hint: "Nenhuma frente de oportunidade",
    },
  ];
  return {
    kpis: {
      eligibleBase: total((item) => item.totals.uniqueCnpj),
      cnpjs: total((item) => item.totals.uniqueCnpj),
      clientes: total((item) => item.totals.uniqueCnpj),
      oportunidades: opportunityCnpj,
      registrosComOportunidade: total((item) => item.opportunities.recordsWithOpportunity),
      oportMovel: total((item) => item.opportunities.mobile),
      oportFtth: total((item) => item.breakdowns.ftth.oportunidades),
      oportLicencas: total((item) => item.opportunities.digital1),
      linhasPotenciais: total((item) => item.totals.mobileParkLines),
      linhasParqueSemFiltros: total((item) => item.totals.mobileParkLinesUnfiltered),
      potencialFinanceiro: total((item) => item.totals.totalPortfolioValue),
      contatosQualificados: total((item) => item.totals.contactableRecords),
      aparelhos: total((item) => item.opportunities.devices),
      avancados: total((item) => item.opportunities.advancedAcquisitionWinback),
      vivoTech: total((item) => item.opportunities.vivoTech),
      cobertura5g: total((item) => item.opportunities.coverage5g),
      percentualComOportunidade: allCnpj ? opportunityCnpj / allCnpj : 0,
    },
    porTipo,
    porParceiro,
    geo,
    categorias,
    destaques,
  };
}

export async function fetchMobile(partnerIds: string[]) {
  const snapshot = await fetchMapaSnapshot();
  const ids = scope(partnerIds, snapshot.partners);
  const selected = selectedMapaScopes(snapshot, ids);
  const total = <T>(select: (scope: MapaScope) => T) => sumMapa(selected, select);
  const baseRec = total((item) => item.opportunities.mobile);
  const elegiveis = Math.round(baseRec * 0.55);
  const linhas = total((item) => item.opportunities.mobileParkLines);
  const meta = Math.round(linhas * 0.28);
  const mensal = Math.round(meta / 6);
  const semanal = Math.round(mensal / 4);
  const diario = Math.round(semanal / 5);
  return {
    kpis: {
      baseRecMovel: baseRec,
      elegiveis,
      linhasPotenciais: linhas,
      metaConversao: meta,
      oportMensal: mensal,
      oportSemanal: semanal,
      oportDiario: diario,
      contatosQualificados: total((item) => item.totals.contactableRecords),
      alimentacaoComercial: Math.round(elegiveis * 0.35),
      cxNecessario: 0,
      creditoAparelhos: total((item) => item.opportunities.deviceCredit),
      renovacaoMovelComAparelho: total((item) => item.opportunities.mobileRenewalWithDevice),
      aparelhoSemRenovacao: total((item) => item.opportunities.devicesWithoutMobileRenewal),
    },
    composicao: mergeMapaRows(selected, (item) => item.breakdowns.mobileComposition, "tipo", [
      "valor",
    ]),
    porParceiro: selected.map(({ partner, scope: partnerScope }) => ({
      parceiro: partner.name,
      baseRecMovel: partnerScope.opportunities.mobile,
      linhasRecMovel: partnerScope.opportunities.mobileParkLines,
    })),
    volume: [
      { periodo: "Mensal", valor: mensal },
      { periodo: "Semanal", valor: semanal },
      { periodo: "Diário", valor: diario },
    ],
  };
}

export async function fetchFtth(partnerIds: string[]) {
  const snapshot = await fetchMapaSnapshot();
  const ids = scope(partnerIds, snapshot.partners);
  const selected = selectedMapaScopes(snapshot, ids);
  const total = <T>(select: (scope: MapaScope) => T) => sumMapa(selected, select);
  const baseBasica = total((item) => item.breakdowns.ftth.baseBasica);
  const oportunidades = total((item) => item.breakdowns.ftth.oportunidades);

  return {
    kpis: {
      cobertura: total((item) => item.breakdowns.ftth.cobertura),
      oportunidades,
      penetracaoBase: baseBasica + oportunidades ? baseBasica / (baseBasica + oportunidades) : 0,
      renovacao: total((item) => item.breakdowns.ftth.renovacao),
      semFtthNoParque: total((item) => item.breakdowns.ftth.semFtthNoParque),
      comFtthNoParque: total((item) => item.breakdowns.ftth.comFtthNoParque),
      convergentes: total((item) => item.breakdowns.ftth.convergentes),
    },
    composicao: mergeMapaRows(selected, (item) => item.breakdowns.ftth.composicao, "tipo", [
      "valor",
    ]),
    geo: mergeMapaRows(selected, (item) => item.breakdowns.ftth.oportunidadesPorCidade, "cidade", [
      "oportunidades",
    ]),
    coberturaVsOport: [
      { grupo: "Sem FTTH no parque", valor: total((item) => item.breakdowns.ftth.semFtthNoParque) },
      { grupo: "Com FTTH no parque", valor: total((item) => item.breakdowns.ftth.comFtthNoParque) },
    ],
    porParceiro: selected.map(({ partner, scope: partnerScope }) => ({
      parceiro: partner.name,
      oportunidades: partnerScope.breakdowns.ftth.oportunidades,
    })),
  };
}
export async function fetchAdvanced(partnerIds: string[]) {
  const snapshot = await fetchMapaSnapshot();
  const ids = scope(partnerIds, snapshot.partners);
  const selected = selectedMapaScopes(snapshot, ids);
  const total = <T>(select: (scope: MapaScope) => T) => sumMapa(selected, select);
  const totalBase = total((item) => item.totals.allCnpj);
  const opportunities = total((item) => item.opportunities.advanced);
  const acquisitionWinback = total((item) => item.opportunities.advancedAcquisitionWinback);
  const renewal = total((item) => item.opportunities.advancedRenewal);
  const vivoTech = total((item) => item.opportunities.vivoTech);
  const totalEvents = total((item) => item.opportunities.totalEvents);

  return {
    kpis: {
      opportunities,
      acquisitionWinback,
      renewal,
      vivoTech,
      percentualBase: totalBase ? acquisitionWinback / totalBase : 0,
      participacaoMix: totalEvents ? acquisitionWinback / totalEvents : 0,
    },
    porParceiro: selected.map(({ partner, scope: partnerScope }) => ({
      parceiro: partner.name,
      oportunidades: partnerScope.opportunities.advancedAcquisitionWinback,
    })),
    comparativo: [
      { tipo: "Oportunidade Avançada", valor: acquisitionWinback },
      { tipo: "Renovação de Avançada", valor: renewal },
    ],
  };
}

export async function fetchLicenses(partnerIds: string[]) {
  const snapshot = await fetchMapaSnapshot();
  const ids = scope(partnerIds, snapshot.partners);
  const selected = selectedMapaScopes(snapshot, ids);
  const total = <T>(select: (scope: MapaScope) => T) => sumMapa(selected, select);
  const base = total((item) => item.totals.allCnpj);
  const elegiveis = total((item) => item.opportunities.digital1);
  const percent = base ? elegiveis / base : 0;
  return {
    kpis: {
      baseElegivel: base,
      clientesElegiveis: elegiveis,
      percentualBase: percent,
    },
    porParceiro: selected.map(({ partner, scope: partnerScope }) => ({
      parceiro: partner.name,
      baseElegivel: partnerScope.totals.allCnpj,
      elegiveis: partnerScope.opportunities.digital1,
    })),
    composicao: mergeMapaRows(selected, (item) => item.breakdowns.digitalComposition, "tipo", [
      "valor",
    ]),
  };
}

export async function fetchQsc(partnerIds: string[]): Promise<QscApiResponse> {
  const query = new URLSearchParams();
  partnerIds.forEach((partnerId) => query.append("partner", partnerId));
  const suffix = query.size ? `?${query.toString()}` : "";
  const response = await fetch(`/api/qsc${suffix}`);
  if (!response.ok) throw new Error("Não foi possível carregar os resultados QSC.");
  return response.json() as Promise<QscApiResponse>;
}

export async function fetchCapacity(partnerIds: string[]) {
  await delay();
  const ids = scope(partnerIds);
  const agg = aggregate(ids);
  const linhas = agg.linhasPotenciais;
  const meta = Math.round(linhas * 0.28);
  const pdu = Math.round(meta / 20);
  const alimMensal = Math.round(meta * 3.2);
  const alimSemanal = Math.round(alimMensal / 4);
  const alimDiario = Math.round(alimSemanal / 5);
  const qualifMensal = Math.round(alimMensal * 0.42);
  const cxNec = agg.cxNecessario + Math.round(meta / 800);
  const cxDisp = Math.round(cxNec * 0.78);
  return {
    kpis: {
      linhasPotenciais: linhas,
      metaEstimada: meta,
      pdu,
      alimMensal,
      alimSemanal,
      alimDiario,
      qualifMensal,
      qualifSemanal: Math.round(qualifMensal / 4),
      qualifDiario: Math.round(qualifMensal / 20),
      cxNecessario: cxNec,
      capacidadeDisponivel: cxDisp,
      gap: Math.max(0, cxNec - cxDisp),
    },
    volume: [
      { periodo: "Mensal", alimentacao: alimMensal, qualificados: qualifMensal },
      { periodo: "Semanal", alimentacao: alimSemanal, qualificados: Math.round(qualifMensal / 4) },
      { periodo: "Diário", alimentacao: alimDiario, qualificados: Math.round(qualifMensal / 20) },
    ],
    capacidade: [
      { nome: "Necessária", valor: cxNec },
      { nome: "Disponível", valor: cxDisp },
    ],
    porParceiro: PARTNER_METRICS.filter((m) => ids.includes(m.partnerId))
      .map((m) => {
        const p = PARTNERS.find((x) => x.id === m.partnerId)!;
        const met = Math.round(m.linhasPotenciais * 0.28);
        const nec = m.cxNecessario + Math.round(met / 800);
        return {
          parceiro: p.name,
          linhas: m.linhasPotenciais,
          meta: met,
          cxNecessario: nec,
          cxDisponivel: Math.round(nec * 0.78),
          gap: Math.max(0, nec - Math.round(nec * 0.78)),
        };
      })
      .sort((a, b) => a.parceiro.localeCompare(b.parceiro, "pt-BR")),
  };
}

export async function fetchPortfolio(
  partnerIds: string[],
  page = 1,
  pageSize = 25,
): Promise<{ rows: PortfolioRow[]; total: number; page: number; pageSize: number }> {
  await delay();
  const ids = scope(partnerIds);
  const filtered = PORTFOLIO.filter((r) => ids.includes(r.partnerId));
  const start = (page - 1) * pageSize;
  return {
    rows: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize,
  };
}

export async function fetchClient(id: string): Promise<PortfolioRow | undefined> {
  await delay(80);
  return PORTFOLIO.find((r) => r.id === id);
}

export async function fetchDataQuality(partnerIds: string[]) {
  const snapshot = await fetchMapaSnapshot();
  const ids = scope(partnerIds, snapshot.partners);
  const selected = selectedMapaScopes(snapshot, ids);
  const totalFor = <T>(select: (scope: MapaScope) => T) => sumMapa(selected, select);
  const filtered = PORTFOLIO.filter((r) => ids.includes(r.partnerId));
  const total = totalFor((item) => item.totals.rawRecords);
  return {
    kpis: {
      registrosProcessados: total,
      cnpjsDistintos: totalFor((item) => item.totals.uniqueCnpj),
      duplicidades: totalFor((item) => item.totals.recurringCnpjRows),
      cnpjsInvalidos: Math.round(total * 0.003),
      camposVazios: Math.round(total * 0.021),
      semParceiro: Math.round(total * 0.001),
      semOportunidade: totalFor((item) => item.opportunities.recordsWithoutOpportunity),
      ultimaCarga: META.processadoEm,
    },
    porTipo: [
      { tipo: "Duplicidades", valor: Math.round(total * 0.008) },
      { tipo: "CNPJ inválido", valor: Math.round(total * 0.003) },
      { tipo: "Campos vazios", valor: Math.round(total * 0.021) },
      { tipo: "Sem parceiro", valor: Math.round(total * 0.001) },
    ],
    porCampo: [
      { campo: "MUNICIPIO", valor: Math.round(total * 0.006) },
      { campo: "UF", valor: Math.round(total * 0.002) },
      { campo: "CNPJ", valor: Math.round(total * 0.003) },
      { campo: "SITUACAO_RECEITA", valor: Math.round(total * 0.004) },
      { campo: "DIGITAL_1", valor: Math.round(total * 0.006) },
    ],
    evolucao: [
      { mes: "Fev", qualidade: 94.1 },
      { mes: "Mar", qualidade: 95.0 },
      { mes: "Abr", qualidade: 95.8 },
      { mes: "Mai", qualidade: 96.4 },
      { mes: "Jun", qualidade: 96.9 },
      { mes: "Jul", qualidade: 97.3 },
    ],
    exemplos: filtered.slice(0, 8).map((r, i) => ({
      id: r.id,
      cnpj: r.cnpj,
      problema: [
        "Campo MUNICIPIO vazio",
        "DIGITAL_1 indefinido",
        "SITUACAO_RECEITA divergente",
        "Duplicidade parcial",
      ][i % 4],
      parceiro: r.partnerName,
    })),
  };
}

export const META_INFO = META;
