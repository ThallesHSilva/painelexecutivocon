// Central service layer. Simulates fetch to the future backend.
// All functions return processed data ready to render.

import {
  PARTNERS,
  PARTNER_METRICS,
  PORTFOLIO,
  UF_DIST,
  META,
  aggregate,
  type Partner,
  type PortfolioRow,
} from "@/mocks/data";

const delay = (ms = 220) => new Promise((r) => setTimeout(r, ms));

function scope(ids: string[]) {
  return ids.length ? ids : PARTNERS.map((p) => p.id);
}

export async function fetchPartners(): Promise<Partner[]> {
  await delay(120);
  return PARTNERS;
}

export async function fetchDashboard(partnerIds: string[]) {
  await delay();
  const ids = scope(partnerIds);
  const agg = aggregate(ids);
  const porTipo = [
    { tipo: "Móvel", valor: agg.oportMovel },
    { tipo: "FTTH", valor: agg.oportFtth },
    { tipo: "Licenças", valor: Math.round(agg.oportLicencas * 0.7) },
    { tipo: "Serviços Digitais", valor: Math.round(agg.oportLicencas * 0.3) },
  ];
  const porParceiro = PARTNER_METRICS.filter((m) => ids.includes(m.partnerId))
    .map((m) => {
      const p = PARTNERS.find((x) => x.id === m.partnerId)!;
      return { partnerId: p.id, parceiro: p.name, oportunidades: m.oportunidades };
    })
    .sort((a, b) => a.parceiro.localeCompare(b.parceiro, "pt-BR"));
  const geo = UF_DIST.map((u) => ({
    uf: u.uf,
    total: Math.round(
      u.total *
        (ids.length === PARTNERS.length
          ? 1
          : ids.length / PARTNERS.length),
    ),
  }));
  const categorias = [
    { categoria: "Com múltiplas oportunidades", valor: Math.round(agg.oportunidades * 0.18) },
    { categoria: "Somente móvel", valor: Math.round(agg.oportunidades * 0.22) },
    { categoria: "Somente FTTH", valor: Math.round(agg.oportunidades * 0.14) },
    { categoria: "Somente licenças", valor: Math.round(agg.oportunidades * 0.12) },
    { categoria: "Sem oportunidade", valor: Math.round(agg.clientes * 0.30) },
  ];
  const destaques = [
    { titulo: "Clientes com oportunidade móvel", valor: agg.oportMovel, hint: "Base REC_MOVEL elegível" },
    { titulo: "Clientes com cobertura FTTH", valor: agg.oportFtth, hint: "Endereço coberto" },
    { titulo: "Elegíveis a licenças", valor: Math.round(agg.oportLicencas * 0.7), hint: "Perfil DIGITAL_1" },
    { titulo: "Múltiplas oportunidades", valor: Math.round(agg.oportunidades * 0.18), hint: "2+ produtos" },
    { titulo: "Maior potencial financeiro", valor: Math.round(agg.oportunidades * 0.06), hint: "Top ticket" },
  ];
  return {
    kpis: {
      cnpjs: agg.cnpjs,
      clientes: agg.clientes,
      oportunidades: agg.oportunidades,
      oportMovel: agg.oportMovel,
      oportFtth: agg.oportFtth,
      oportLicencas: agg.oportLicencas,
      linhasPotenciais: agg.linhasPotenciais,
      potencialFinanceiro: agg.potencialFinanceiro,
      contatosQualificados: agg.contatosQualificados,
      cxNecessario: agg.cxNecessario,
      percentualComOportunidade: agg.clientes ? (agg.oportunidades / agg.clientes) * 0.6 : 0,
    },
    porTipo,
    porParceiro,
    geo,
    categorias,
    destaques,
  };
}

export async function fetchMobile(partnerIds: string[]) {
  await delay();
  const ids = scope(partnerIds);
  const agg = aggregate(ids);
  const baseRec = Math.round(agg.clientes * 0.72);
  const elegiveis = Math.round(baseRec * 0.55);
  const linhas = agg.linhasPotenciais;
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
      contatosQualificados: agg.contatosQualificados,
      alimentacaoComercial: Math.round(elegiveis * 0.35),
      cxNecessario: agg.cxNecessario,
    },
    composicao: [
      { tipo: "Expansão de linhas", valor: Math.round(elegiveis * 0.42) },
      { tipo: "Novos titulares", valor: Math.round(elegiveis * 0.28) },
      { tipo: "Migração pré→pós", valor: Math.round(elegiveis * 0.18) },
      { tipo: "Convergência", valor: Math.round(elegiveis * 0.12) },
    ],
    porParceiro: PARTNER_METRICS.filter((m) => ids.includes(m.partnerId))
      .map((m) => {
        const p = PARTNERS.find((x) => x.id === m.partnerId)!;
        return {
          parceiro: p.name,
          elegiveis: Math.round(m.clientes * 0.55),
          linhas: m.linhasPotenciais,
          cx: m.cxNecessario,
        };
      })
      .sort((a, b) => a.parceiro.localeCompare(b.parceiro, "pt-BR")),
    volume: [
      { periodo: "Mensal", valor: mensal },
      { periodo: "Semanal", valor: semanal },
      { periodo: "Diário", valor: diario },
    ],
  };
}

export async function fetchFtth(partnerIds: string[]) {
  await delay();
  const ids = scope(partnerIds);
  const agg = aggregate(ids);
  const cobertura = Math.round(agg.clientes * 0.48);
  const elegiveis = agg.oportFtth;
  return {
    kpis: {
      cobertura,
      elegiveis,
      renovacao: Math.round(elegiveis * 0.22),
      convergentes: Math.round(elegiveis * 0.18),
      movelMaisFtth: Math.round(elegiveis * 0.31),
      potencial: Math.round(elegiveis * 340),
    },
    composicao: [
      { tipo: "Nova venda", valor: Math.round(elegiveis * 0.48) },
      { tipo: "Renovação", valor: Math.round(elegiveis * 0.22) },
      { tipo: "Convergência móvel+FTTH", valor: Math.round(elegiveis * 0.18) },
      { tipo: "Upgrade velocidade", valor: Math.round(elegiveis * 0.12) },
    ],
    geo: UF_DIST.map((u) => ({ uf: u.uf, cobertura: Math.round(u.total * 0.6), oportunidade: Math.round(u.total * 0.35) })),
    coberturaVsOport: [
      { grupo: "Coberto e sem produto", valor: Math.round(cobertura * 0.42) },
      { grupo: "Coberto com produto", valor: Math.round(cobertura * 0.38) },
      { grupo: "Coberto e renovação", valor: Math.round(cobertura * 0.20) },
    ],
    porParceiro: PARTNER_METRICS.filter((m) => ids.includes(m.partnerId))
      .map((m) => {
        const p = PARTNERS.find((x) => x.id === m.partnerId)!;
        return { parceiro: p.name, cobertura: Math.round(m.clientes * 0.48), oportunidade: m.oportFtth };
      })
      .sort((a, b) => a.parceiro.localeCompare(b.parceiro, "pt-BR")),
  };
}

export async function fetchLicenses(partnerIds: string[]) {
  await delay();
  const ids = scope(partnerIds);
  const agg = aggregate(ids);
  const base = Math.round(agg.clientes * 0.62);
  const elegiveis = agg.oportLicencas;
  const percent = base ? elegiveis / base : 0;
  return {
    kpis: {
      baseElegivel: base,
      clientesElegiveis: elegiveis,
      percentualBase: percent,
      potencialAdocao: Math.round(elegiveis * 0.34),
      cenario34: Math.round(elegiveis * 0.34 * 34 * 12),
      cenario100: Math.round(elegiveis * 0.34 * 100 * 12),
      totalEstimado: Math.round(elegiveis * 0.34 * 62 * 12),
    },
    porParceiro: PARTNER_METRICS.filter((m) => ids.includes(m.partnerId))
      .map((m) => {
        const p = PARTNERS.find((x) => x.id === m.partnerId)!;
        return { parceiro: p.name, baseElegivel: Math.round(m.clientes * 0.62), elegiveis: m.oportLicencas };
      })
      .sort((a, b) => a.parceiro.localeCompare(b.parceiro, "pt-BR")),
    composicao: [
      { tipo: "Microsoft 365", valor: Math.round(elegiveis * 0.42) },
      { tipo: "Google Workspace", valor: Math.round(elegiveis * 0.22) },
      { tipo: "Segurança digital", valor: Math.round(elegiveis * 0.20) },
      { tipo: "Backup e cloud", valor: Math.round(elegiveis * 0.16) },
    ],
    potencial: [
      { cenario: "Conservador (R$34)", valor: Math.round(elegiveis * 0.34 * 34 * 12) },
      { cenario: "Médio (R$62)", valor: Math.round(elegiveis * 0.34 * 62 * 12) },
      { cenario: "Otimista (R$100)", valor: Math.round(elegiveis * 0.34 * 100 * 12) },
    ],
  };
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
  await delay();
  const ids = scope(partnerIds);
  const filtered = PORTFOLIO.filter((r) => ids.includes(r.partnerId));
  const total = filtered.length * 12;
  return {
    kpis: {
      registrosProcessados: total,
      cnpjsDistintos: filtered.length,
      duplicidades: Math.round(total * 0.008),
      cnpjsInvalidos: Math.round(total * 0.003),
      camposVazios: Math.round(total * 0.021),
      semParceiro: Math.round(total * 0.001),
      semOportunidade: Math.round(filtered.length * 0.28),
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
      problema: ["Campo MUNICIPIO vazio", "DIGITAL_1 indefinido", "SITUACAO_RECEITA divergente", "Duplicidade parcial"][i % 4],
      parceiro: r.partnerName,
    })),
  };
}

export const META_INFO = META;
