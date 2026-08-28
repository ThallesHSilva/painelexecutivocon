import { createFileRoute } from "@tanstack/react-router";
import {
  assignPartnersToGn,
  isSameOriginRequest,
  requireDirector,
  usersForAdministration,
} from "@/lib/auth.server";
import { getDataSnapshot } from "@/lib/snapshots.server";

type BaseUpdate = { available: boolean; updatedAt: string | null };
type BaseUpdates = Record<
  | "mapaParque"
  | "qscCarteira"
  | "qscFixa"
  | "qscMovel"
  | "resultadosYoy"
  | "bestGuess"
  | "portabilidade",
  BaseUpdate
>;

function normalizePartnerName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

function slugifyPartner(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function sourceUpdateAt(source: { importedAt?: string; sourceModifiedAt?: string }) {
  return source.importedAt ?? source.sourceModifiedAt ?? null;
}

function availablePartners() {
  const mapaParqueSnapshot = getDataSnapshot("mapa-parque");
  const qscSnapshot = getDataSnapshot("qsc");
  const resultadosYoySnapshot = getDataSnapshot("resultados-yoy");
  const bestGuessSnapshot = getDataSnapshot("best-guess");
  const portabilidadeSnapshot = getDataSnapshot("portabilidade-analitica");
  const partners = new Map<string, { id: string; name: string }>();
  for (const partner of [...mapaParqueSnapshot.partners, ...qscSnapshot.partners]) {
    partners.set(normalizePartnerName(partner.name), { id: partner.id, name: partner.name });
  }

  const companyNames = [
    ...resultadosYoySnapshot.records.map((record) => record.company),
    ...bestGuessSnapshot.records.map((record) => record.company),
    ...portabilidadeSnapshot.records.map((record) => record.company),
  ];
  for (const name of companyNames) {
    const normalized = normalizePartnerName(name);
    if (!normalized || partners.has(normalized)) continue;
    partners.set(normalized, { id: slugifyPartner(name), name });
  }

  const mapaPartners = new Set(
    mapaParqueSnapshot.partners.map((partner) => normalizePartnerName(partner.name)),
  );
  const qscPartners = new Set(
    qscSnapshot.partners.map((partner) => normalizePartnerName(partner.name)),
  );
  const resultadosPartners = new Set(
    resultadosYoySnapshot.records.map((record) => normalizePartnerName(record.company)),
  );
  const bestGuessPartners = new Set(
    bestGuessSnapshot.records.map((record) => normalizePartnerName(record.company)),
  );
  const portabilidadePartners = new Set(
    portabilidadeSnapshot.records.map((record) => normalizePartnerName(record.company)),
  );
  const qscDates = Object.fromEntries(
    qscSnapshot.source.map((source) => [source.domain, source.sourceModifiedAt]),
  ) as Record<string, string>;

  return [...partners.entries()]
    .map(([normalizedName, partner]) => {
      const updates: BaseUpdates = {
        mapaParque: {
          available: mapaPartners.has(normalizedName),
          updatedAt: mapaPartners.has(normalizedName)
            ? mapaParqueSnapshot.source.sourceModifiedAt
            : null,
        },
        qscCarteira: {
          available: qscPartners.has(normalizedName),
          updatedAt: qscPartners.has(normalizedName) ? (qscDates.carteira ?? null) : null,
        },
        qscFixa: {
          available: qscPartners.has(normalizedName),
          updatedAt: qscPartners.has(normalizedName) ? (qscDates.fixa ?? null) : null,
        },
        qscMovel: {
          available: qscPartners.has(normalizedName),
          updatedAt: qscPartners.has(normalizedName) ? (qscDates.movel ?? null) : null,
        },
        resultadosYoy: {
          available: resultadosPartners.has(normalizedName),
          updatedAt: resultadosPartners.has(normalizedName)
            ? sourceUpdateAt(resultadosYoySnapshot.source)
            : null,
        },
        bestGuess: {
          available: bestGuessPartners.has(normalizedName),
          updatedAt: bestGuessPartners.has(normalizedName)
            ? sourceUpdateAt(bestGuessSnapshot.source)
            : null,
        },
        portabilidade: {
          available: portabilidadePartners.has(normalizedName),
          updatedAt: portabilidadePartners.has(normalizedName)
            ? sourceUpdateAt(portabilidadeSnapshot.source)
            : null,
        },
      };
      return { ...partner, updates };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
}

export const Route = createFileRoute("/api/director/access")({
  server: {
    handlers: {
      GET: async () => {
        if (!(await requireDirector())) {
          return Response.json({ message: "Acesso restrito ao diretor." }, { status: 403 });
        }
        return Response.json(
          {
            users: usersForAdministration().filter(
              (user) => user.role === "gn" && user.status === "approved",
            ),
            partners: availablePartners(),
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
      PATCH: async ({ request }) => {
        if (!(await requireDirector())) {
          return Response.json({ message: "Acesso restrito ao diretor." }, { status: 403 });
        }
        if (!isSameOriginRequest(request)) {
          return Response.json({ message: "Origem não permitida." }, { status: 403 });
        }
        const body = (await request.json()) as { userId?: unknown; partnerIds?: unknown };
        const userId = Number(body.userId);
        const partnerIds = Array.isArray(body.partnerIds)
          ? body.partnerIds.filter((id): id is string => typeof id === "string")
          : null;
        const availableIds = new Set(availablePartners().map((partner) => partner.id));
        if (
          !Number.isInteger(userId) ||
          userId <= 0 ||
          !partnerIds ||
          partnerIds.some((id) => !availableIds.has(id))
        ) {
          return Response.json({ message: "Solicitação inválida." }, { status: 400 });
        }
        if (!assignPartnersToGn(userId, partnerIds)) {
          return Response.json({ message: "GN não encontrado." }, { status: 404 });
        }
        return Response.json({ updated: true }, { headers: { "Cache-Control": "no-store" } });
      },
    },
  },
});
