import type {
  BestGuessSnapshot,
  MapaSnapshot,
  Partner,
  PortabilidadeSnapshot,
  ResultadosYoySnapshot,
  ServiceTower,
  TorresServicoSnapshot,
} from "./snapshot-types";

type ResultsUser = {
  role: "admin" | "director" | "gn";
  partnerIds: string[];
};

type ResultsSnapshots = {
  mapa: Pick<MapaSnapshot, "partners">;
  resultados: ResultadosYoySnapshot;
  bestGuess: BestGuessSnapshot;
  portabilidade: PortabilidadeSnapshot;
  torres: TorresServicoSnapshot;
};

export function normalizeCompany(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function createPartnerNameResolver(partners: Partner[]) {
  const canonicalNames = partners.map((partner) => ({
    name: partner.name,
    key: normalizeCompany(partner.name),
  }));

  return (sourceName: string) => {
    const sourceKey = normalizeCompany(sourceName);
    const exactMatch = canonicalNames.find((partner) => partner.key === sourceKey);
    if (exactMatch) return exactMatch.name;

    // The commercial workbook commonly abbreviates company names by omitting
    // suffixes such as "Telecom" or "Business". Only accept a prefix match
    // when it identifies a single partner, avoiding unsafe fuzzy associations.
    const prefixMatches = canonicalNames.filter(
      (partner) => partner.key.startsWith(sourceKey) || sourceKey.startsWith(partner.key),
    );
    return prefixMatches.length === 1 ? prefixMatches[0].name : sourceName;
  };
}

function reconcileTowerPartnerNames(
  snapshot: TorresServicoSnapshot,
  partners: Partner[],
): TorresServicoSnapshot {
  const resolvePartnerName = createPartnerNameResolver(partners);
  return {
    ...snapshot,
    towers: snapshot.towers.map((tower) => ({
      ...tower,
      rows: tower.rows.map((row) => ({
        ...row,
        partner: resolvePartnerName(row.partner),
      })),
    })),
  };
}

function scopedTowerTotal(tower: ServiceTower): ServiceTower["total"] {
  if (tower.rows.length === 0) return {};

  // Mirrors the importer fallback: totals are the sum of the finite numeric
  // values available in the rows. This avoids exposing the source's global TT
  // row to a GN whose authorization covers only part of the dataset.
  return Object.fromEntries(
    tower.columns.map((column) => [
      column.key,
      tower.rows.reduce((sum, row) => {
        const value = row.values[column.key];
        return sum + (typeof value === "number" && Number.isFinite(value) ? value : 0);
      }, 0),
    ]),
  );
}

export function buildAuthorizedResultsPayload(user: ResultsUser, snapshots: ResultsSnapshots) {
  if (user.role === "admin") {
    throw new Error("Administradores não podem acessar dados de resultados.");
  }

  const authorizedNames =
    user.role === "gn"
      ? new Set(
          snapshots.mapa.partners
            .filter((partner) => user.partnerIds.includes(partner.id))
            .map((partner) => normalizeCompany(partner.name)),
        )
      : null;
  const canSeeCompany = (company: string) =>
    authorizedNames === null || authorizedNames.has(normalizeCompany(company));

  const bestGuessRecords = snapshots.bestGuess.records.filter((record) =>
    canSeeCompany(record.company),
  );
  const bestGuessTotal = bestGuessRecords.reduce(
    (total, record) => ({
      m0MtdPortIn: total.m0MtdPortIn + record.m0MtdPortIn,
      m0MtdPortOut: total.m0MtdPortOut + record.m0MtdPortOut,
      m0MtdSaldo: total.m0MtdSaldo + record.m0MtdSaldo,
      bgFmPortIn: total.bgFmPortIn + record.bgFmPortIn,
      bgFmPortOut: total.bgFmPortOut + record.bgFmPortOut,
      bgFmSaldo: total.bgFmSaldo + record.bgFmSaldo,
    }),
    {
      m0MtdPortIn: 0,
      m0MtdPortOut: 0,
      m0MtdSaldo: 0,
      bgFmPortIn: 0,
      bgFmPortOut: 0,
      bgFmSaldo: 0,
    },
  );

  const reconciledTowers = reconcileTowerPartnerNames(snapshots.torres, snapshots.mapa.partners);
  const torres =
    authorizedNames === null
      ? reconciledTowers
      : {
          ...reconciledTowers,
          towers: reconciledTowers.towers.map((tower) => {
            const scopedTower = {
              ...tower,
              rows: tower.rows.filter((row) => canSeeCompany(row.partner)),
            };
            return { ...scopedTower, total: scopedTowerTotal(scopedTower) };
          }),
        };

  return {
    resultados: {
      source: snapshots.resultados.source,
      records: snapshots.resultados.records.filter((record) => canSeeCompany(record.company)),
    },
    bestGuess: {
      source: snapshots.bestGuess.source,
      records: bestGuessRecords,
      total: bestGuessTotal,
    },
    portabilidade: {
      source: snapshots.portabilidade.source,
      records: snapshots.portabilidade.records.filter((record) => canSeeCompany(record.company)),
    },
    torres,
  };
}
