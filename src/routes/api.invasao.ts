import { createFileRoute } from "@tanstack/react-router";
import { readAuthUser } from "@/lib/auth.server";
import { getDataSnapshot } from "@/lib/snapshots.server";

const key = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();

export const Route = createFileRoute("/api/invasao")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await readAuthUser();
        if (!user || user.role === "admin")
          return Response.json({ message: "Acesso não autorizado." }, { status: 403 });

        const snapshot = getDataSnapshot("invasao-carteira");
        // O parceiro da base de invasão é identificado pelo nome; o id canônico é o do Mapa Parque.
        const known = [
          ...getDataSnapshot("mapa-parque").partners,
          ...getDataSnapshot("qsc").partners,
        ];
        const canonical = new Map(
          snapshot.partners.map((partner) => [
            partner.id,
            known.find((k) => key(k.name) === key(partner.name) || key(k.id) === key(partner.id)) ??
              partner,
          ]),
        );
        const requested = new URL(request.url).searchParams.getAll("partner");
        const authorized = snapshot.partners.filter(
          (partner) =>
            user.role === "director" || user.partnerIds.includes(canonical.get(partner.id)!.id),
        );
        const ids = new Set(
          authorized
            .filter(
              (partner) => !requested.length || requested.includes(canonical.get(partner.id)!.id),
            )
            .map((partner) => partner.id),
        );
        const scoped = <T extends { partnerId: string; partnerName: string }>(item: T) => ({
          ...item,
          partnerName: canonical.get(item.partnerId)!.name,
          partnerId: canonical.get(item.partnerId)!.id,
        });
        const periods = snapshot.periods.filter((period) => ids.has(period.partnerId));
        const months = [...new Set(periods.map((period) => period.month))].sort();

        return Response.json(
          {
            source: snapshot.source,
            latestMonth: months.at(-1) ?? "",
            months,
            partners: [
              ...new Map(
                authorized.map((partner) => {
                  const current = canonical.get(partner.id)!;
                  return [current.id, { id: current.id, name: current.name }];
                }),
              ).values(),
            ],
            periods: periods.map(scoped),
            records: snapshot.records.filter((record) => ids.has(record.partnerId)).map(scoped),
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
