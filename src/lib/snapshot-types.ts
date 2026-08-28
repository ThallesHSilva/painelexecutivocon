export type Partner = { id: string; name: string };

export type NumericMap = Record<string, number>;
export type NamedValue = Record<string, string | number>;

export type MapaScope = {
  totals: NumericMap;
  opportunities: NumericMap;
  breakdowns: {
    byType: NamedValue[];
    byCategory: NamedValue[];
    byCity: NamedValue[];
    mobileComposition: NamedValue[];
    ftth: NumericMap & {
      composicao: NamedValue[];
      oportunidadesPorCidade: NamedValue[];
    };
    digitalComposition: NamedValue[];
    status: NamedValue[];
    mei: NamedValue[];
  };
  quality: NumericMap & { sourceMojibakeDetected?: boolean };
};

export type MapaSnapshot = {
  schemaVersion: number;
  source: {
    fileName: string;
    fileSizeBytes: number;
    encoding: string;
    delimiter: string;
    importedAt: string;
    sourceModifiedAt: string;
  };
  rules: Record<string, string> & { version: string };
  partners: Partner[];
  scopes: Record<string, MapaScope>;
  totals: NumericMap;
  opportunities: NumericMap;
  breakdowns: MapaScope["breakdowns"];
  quality: MapaScope["quality"];
};

export type ResultadosYoySnapshot = {
  source: {
    report: string;
    companyColumn: string;
    period: string;
    monthsElapsed: number;
    previousPeriod: string;
    importedAt: string;
  };
  records: Array<{
    company: string;
    product: string;
    meta: number;
    real: number;
    previousMeta: number;
    previousReal: number;
  }>;
};

export type BestGuessRecord = {
  company: string;
  division: string;
  m0MtdPortIn: number;
  m0MtdPortOut: number;
  m0MtdSaldo: number;
  bgFmPortIn: number;
  bgFmPortOut: number;
  bgFmSaldo: number;
};

export type BestGuessTotal = Omit<BestGuessRecord, "company" | "division">;

export type BestGuessSnapshot = {
  source: Record<string, string>;
  records: BestGuessRecord[];
  total: BestGuessTotal;
};

export type PortabilidadeSnapshot = {
  source: Record<string, string>;
  records: Array<{
    company: string;
    month: number;
    operator: string;
    portIn: number;
    portOut: number;
  }>;
};

export type ServiceTower = {
  id: string;
  title: string;
  sourceTitle: string;
  columns: Array<{ key: string; label: string; format: string }>;
  rows: Array<{
    partner: string;
    values: Record<string, string | number | null>;
  }>;
  total: Record<string, string | number | null>;
};

export type TorresServicoSnapshot = {
  source: Record<string, string>;
  towers: ServiceTower[];
};

export type QscPoint = {
  competence: string;
  value: number | null;
  numerator: number | null;
  denominator: number | null;
  available: boolean;
  zeroPark: boolean;
  score: number | null;
  scoreBand: string | null;
};

export type QscStoredMetric = {
  id: string;
  domain: string;
  label: string;
  formula: string;
  interpretation: string;
  favorableDirection: "up" | "down";
  scoreRules: Array<{ start: number; end: number; score: number; band: string }>;
  latest: QscPoint | null;
};

export type QscSnapshot = {
  schemaVersion: number;
  importedAt: string;
  updateFrequency: string;
  source: Array<Record<string, string | number>>;
  competencies: string[];
  partners: Partner[];
  metricCount: number;
  scopes: Array<{
    id: string;
    name: string;
    partnerIds: string[];
    rowsByCompetence: Record<string, number>;
    metrics: QscStoredMetric[];
  }>;
};

export type SnapshotKindMap = {
  "mapa-parque": MapaSnapshot;
  "resultados-yoy": ResultadosYoySnapshot;
  "best-guess": BestGuessSnapshot;
  "portabilidade-analitica": PortabilidadeSnapshot;
  "torres-servico": TorresServicoSnapshot;
  qsc: QscSnapshot;
};

export const EMPTY_MAPA_SNAPSHOT: MapaSnapshot = {
  schemaVersion: 1,
  source: {
    fileName: "",
    fileSizeBytes: 0,
    encoding: "",
    delimiter: "",
    importedAt: "",
    sourceModifiedAt: "",
  },
  rules: { version: "" },
  partners: [],
  scopes: {},
  totals: {},
  opportunities: {},
  breakdowns: {
    byType: [],
    byCategory: [],
    byCity: [],
    mobileComposition: [],
    ftth: { composicao: [], oportunidadesPorCidade: [] },
    digitalComposition: [],
    status: [],
    mei: [],
  },
  quality: {},
};

export const EMPTY_SNAPSHOTS: SnapshotKindMap = {
  "mapa-parque": EMPTY_MAPA_SNAPSHOT,
  "resultados-yoy": {
    source: {
      report: "",
      companyColumn: "",
      period: "YTD por produto",
      monthsElapsed: 1,
      previousPeriod: "",
      importedAt: "",
    },
    records: [],
  },
  "best-guess": {
    source: {},
    records: [],
    total: {
      m0MtdPortIn: 0,
      m0MtdPortOut: 0,
      m0MtdSaldo: 0,
      bgFmPortIn: 0,
      bgFmPortOut: 0,
      bgFmSaldo: 0,
    },
  },
  "portabilidade-analitica": { source: {}, records: [] },
  "torres-servico": { source: {}, towers: [] },
  qsc: {
    schemaVersion: 1,
    importedAt: "",
    updateFrequency: "Semanal",
    source: [],
    competencies: [],
    partners: [],
    metricCount: 0,
    scopes: [],
  },
};
