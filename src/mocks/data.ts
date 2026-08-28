import { EMPTY_MAPA_SNAPSHOT as snapshot } from "@/lib/snapshot-types";

// Temporary compatibility layer while the application backend is implemented.
// The dashboard metrics below come from the real processed MAPA PARQUE snapshot.

export interface Partner {
  id: string;
  name: string;
}

export const PARTNERS: Partner[] = snapshot.partners;

// Deterministic pseudo-random using seed
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h;
}
const pr = (seed: string, min: number, max: number) => {
  const v = hash(seed) / 0xffffffff;
  return Math.floor(min + v * (max - min));
};

export interface PartnerMetrics {
  partnerId: string;
  cnpjs: number;
  clientes: number;
  oportunidades: number;
  oportMovel: number;
  oportFtth: number;
  oportLicencas: number;
  linhasPotenciais: number;
  linhasRecMovel: number;
  potencialFinanceiro: number; // R$
  contatosQualificados: number;
  cxNecessario: number;
}

export const PARTNER_METRICS: PartnerMetrics[] = PARTNERS.map((partner) => {
  const partnerScope = snapshot.scopes[partner.id as keyof typeof snapshot.scopes];
  return {
    partnerId: partner.id,
    cnpjs: partnerScope.totals.uniqueCnpj,
    clientes: partnerScope.totals.uniqueCnpj,
    oportunidades: partnerScope.opportunities.totalEvents,
    oportMovel: partnerScope.opportunities.mobile,
    oportFtth: partnerScope.opportunities.ftth,
    oportLicencas: partnerScope.opportunities.digital1,
    linhasPotenciais: partnerScope.totals.mobileParkLines,
    linhasRecMovel: partnerScope.opportunities.mobileParkLines,
    potencialFinanceiro: partnerScope.totals.totalPortfolioValue,
    contatosQualificados: partnerScope.totals.contactableRecords,
    cxNecessario: 0,
  };
});

export function aggregate(partnerIds: string[]) {
  const ids = partnerIds.length ? partnerIds : PARTNERS.map((p) => p.id);
  const rows = PARTNER_METRICS.filter((m) => ids.includes(m.partnerId));
  return rows.reduce(
    (acc, r) => {
      acc.cnpjs += r.cnpjs;
      acc.clientes += r.clientes;
      acc.oportunidades += r.oportunidades;
      acc.oportMovel += r.oportMovel;
      acc.oportFtth += r.oportFtth;
      acc.oportLicencas += r.oportLicencas;
      acc.linhasPotenciais += r.linhasPotenciais;
      acc.linhasRecMovel += r.linhasRecMovel;
      acc.potencialFinanceiro += r.potencialFinanceiro;
      acc.contatosQualificados += r.contatosQualificados;
      acc.cxNecessario += r.cxNecessario;
      return acc;
    },
    {
      cnpjs: 0,
      clientes: 0,
      oportunidades: 0,
      oportMovel: 0,
      oportFtth: 0,
      oportLicencas: 0,
      linhasPotenciais: 0,
      linhasRecMovel: 0,
      potencialFinanceiro: 0,
      contatosQualificados: 0,
      cxNecessario: 0,
    },
  );
}

export const UFS = ["SP", "RJ", "MG", "RS", "PR", "SC", "BA", "PE", "CE", "GO", "DF", "AM"];
export const CIDADES: Record<string, string[]> = {
  SP: ["São Paulo", "Campinas", "Santos"],
  RJ: ["Rio de Janeiro", "Niterói", "Petrópolis"],
  MG: ["Belo Horizonte", "Uberlândia"],
  RS: ["Porto Alegre", "Caxias do Sul"],
  PR: ["Curitiba", "Londrina"],
  SC: ["Florianópolis", "Joinville"],
  BA: ["Salvador", "Feira de Santana"],
  PE: ["Recife", "Olinda"],
  CE: ["Fortaleza"],
  GO: ["Goiânia"],
  DF: ["Brasília"],
  AM: ["Manaus"],
};

export interface PortfolioRow {
  id: string;
  partnerId: string;
  partnerName: string;
  cnpj: string;
  razaoSocial: string;
  municipio: string;
  uf: string;
  parqueMovel: number;
  recMovel: number;
  oportMovel: boolean;
  oportFtth: boolean;
  oportLicencas: boolean;
  servicosDigitais: boolean;
  qtdOportunidades: number;
  potencial: number;
  produtos: string[];
  justificativas: string[];
  atualizadoEm: string;
}

function pad(n: number, len: number) {
  return String(n).padStart(len, "0");
}

const RAZOES = [
  "Comercial",
  "Indústria",
  "Serviços",
  "Distribuidora",
  "Consultoria",
  "Logística",
  "Engenharia",
  "Alimentos",
  "Tecnologia",
  "Varejo",
];

export const PORTFOLIO: PortfolioRow[] = (() => {
  const rows: PortfolioRow[] = [];
  let idx = 0;
  for (const p of PARTNERS) {
    const count = pr(p.id + "port", 22, 42);
    for (let i = 0; i < count; i++) {
      idx++;
      const seed = `${p.id}-${i}`;
      const uf = UFS[pr(seed + "uf", 0, UFS.length)];
      const city = CIDADES[uf][pr(seed + "ci", 0, CIDADES[uf].length)];
      const parqueMovel = pr(seed + "pm", 3, 180);
      const recMovel = pr(seed + "rec", 800, 42000);
      const oportMovel = pr(seed + "om", 0, 10) > 3;
      const oportFtth = pr(seed + "of", 0, 10) > 5;
      const oportLicencas = pr(seed + "ol", 0, 10) > 4;
      const servicosDigitais = pr(seed + "sd", 0, 10) > 6;
      const qtdOportunidades =
        Number(oportMovel) + Number(oportFtth) + Number(oportLicencas) + Number(servicosDigitais);
      const potencial = pr(seed + "pot", 1200, 48000);
      const razao = `${RAZOES[pr(seed + "rz", 0, RAZOES.length)]} ${city} ${pr(seed + "n", 10, 999)} LTDA`;
      const cnpjRaw =
        pad(pr(seed + "cnpj", 1, 99999999), 8) + "0001" + pad(pr(seed + "d", 10, 99), 2);
      const cnpj = `${cnpjRaw.slice(0, 2)}.${cnpjRaw.slice(2, 5)}.${cnpjRaw.slice(5, 8)}/${cnpjRaw.slice(8, 12)}-${cnpjRaw.slice(12)}`;
      const produtos = [
        parqueMovel > 0 ? "Móvel Pós" : null,
        oportFtth ? "FTTH 300 Mbps" : null,
        oportLicencas ? "Microsoft 365" : null,
        servicosDigitais ? "Cloud Backup" : null,
      ].filter(Boolean) as string[];
      const justificativas = [
        oportMovel ? "Base REC_MOVEL com espaço para expansão de linhas." : null,
        oportFtth ? "Endereço com cobertura FTTH ativa e cliente sem produto fixo." : null,
        oportLicencas ? "Perfil DIGITAL_1 elegível a pacote de licenças." : null,
        servicosDigitais ? "Ticket compatível com adoção de serviços digitais." : null,
      ].filter(Boolean) as string[];
      rows.push({
        id: `c${pad(idx, 5)}`,
        partnerId: p.id,
        partnerName: p.name,
        cnpj,
        razaoSocial: razao,
        municipio: city,
        uf,
        parqueMovel,
        recMovel,
        oportMovel,
        oportFtth,
        oportLicencas,
        servicosDigitais,
        qtdOportunidades,
        potencial,
        produtos,
        justificativas,
        atualizadoEm: "2026-07-14",
      });
    }
  }
  return rows;
})();

export const UF_DIST = UFS.map((uf) => ({
  uf,
  total: PORTFOLIO.filter((r) => r.uf === uf).reduce((s, r) => s + r.qtdOportunidades, 0),
})).sort((a, b) => b.total - a.total);

export const META = {
  regrasVersao: snapshot.rules.version,
  processadoEm: snapshot.source.importedAt,
  dataBase: snapshot.source.sourceModifiedAt.slice(0, 10),
  registrosProcessados: snapshot.totals.rawRecords,
  status: "Amostra real carregada",
};
