import type { QscDomain, QscDomainHistorySeries } from "./qsc.ts";
import type { QscPoint, QscStoredMetric } from "./snapshot-types.ts";

interface PartnerScope {
  id: string;
  metrics: Array<Pick<QscStoredMetric, "id" | "domain" | "latest" | "scoreRules">>;
}

/** Equal partner weight, after summing that partner's weighted KPI components. */
export function buildQscDomainHistory(
  scopes: PartnerScope[],
  selectedIds: string[],
  competencies: string[],
  currentCompetence: string,
): QscDomainHistorySeries[] {
  const selected = new Set(selectedIds);
  const months = [...new Set(competencies)].filter((month) => month <= currentCompetence).sort();
  const totals = new Map<string, Map<string, number>>();
  const seen = new Map<string, QscPoint>();

  for (const scope of scopes) {
    if (scope.id === "__all__" || !selected.has(scope.id)) continue;
    for (const metric of scope.metrics) {
      const point = metric.latest;
      if (!point || !["carteira", "fixa", "movel"].includes(metric.domain)) continue;
      if (!months.includes(point.competence)) continue;
      const key = JSON.stringify([scope.id, metric.id, point.competence]);
      const previous = seen.get(key);
      if (previous) {
        if (
          !Object.keys(point).every((field) =>
            Object.is(point[field as keyof QscPoint], previous[field as keyof QscPoint]),
          ) ||
          Object.keys(previous).length !== Object.keys(point).length
        ) {
          throw new Error(
            `QSC: indicador duplicado conflitante (${scope.id}, ${metric.id}, ${point.competence}).`,
          );
        }
        continue;
      }
      seen.set(key, point);
      if (
        !point.available ||
        point.zeroPark ||
        point.score === null ||
        !Number.isFinite(point.score)
      )
        continue;
      const ruleScores = metric.scoreRules.map((rule) => rule.score).filter(Number.isFinite);
      if (ruleScores.length && point.score > Math.max(...ruleScores)) {
        throw new Error(
          `QSC: nota ${point.score} acima do máximo do indicador (${scope.id}, ${metric.id}, ${point.competence}).`,
        );
      }
      const domainMonth = JSON.stringify([metric.domain, point.competence]);
      const partners = totals.get(domainMonth) ?? new Map<string, number>();
      partners.set(scope.id, (partners.get(scope.id) ?? 0) + point.score);
      totals.set(domainMonth, partners);
    }
  }

  return (["carteira", "fixa", "movel"] as const).map((domain) => ({
    domain,
    history: months.map((competence) => {
      const partners = totals.get(JSON.stringify([domain, competence]));
      const scores = [...(partners?.values() ?? [])];
      return {
        competence,
        score: scores.length ? scores.reduce((sum, score) => sum + score, 0) / scores.length : null,
        partnerCount: scores.length,
      };
    }),
  }));
}

/** A corrupt historical point must not take down the current KPI response. */
export function qscDomainHistoryResult(...args: Parameters<typeof buildQscDomainHistory>): {
  domainHistory: QscDomainHistorySeries[];
  domainHistoryUnavailable: boolean;
} {
  try {
    return { domainHistory: buildQscDomainHistory(...args), domainHistoryUnavailable: false };
  } catch (error) {
    console.error("Histórico semestral QSC indisponível:", error);
    return { domainHistory: [], domainHistoryUnavailable: true };
  }
}

/** Preserve the existing round-before-rating semester boundary. */
export function qscSemesterValues(
  domain: QscDomain,
  series: QscDomainHistorySeries[] | undefined,
  competencies: string[],
) {
  const history = series?.find((item) => item.domain === domain)?.history ?? [];
  const values = competencies.map(
    (month) => history.find((point) => point.competence === month)?.score ?? null,
  );
  const available = values.filter(
    (score): score is number => score !== null && Number.isFinite(score),
  );
  return {
    values,
    availableCount: available.length,
    totalizer: available.length
      ? Math.round(available.reduce((sum, score) => sum + score, 0) / available.length) || 0
      : null,
  };
}
