import { createFileRoute } from "@tanstack/react-router";
import { readAuthUser } from "@/lib/auth.server";
import { getDataSnapshot } from "@/lib/snapshots.server";

export const Route = createFileRoute("/api/data/mapa")({
  server: {
    handlers: {
      GET: async () => {
        const user = await readAuthUser();
        if (!user || user.role === "admin") {
          return Response.json({ message: "Acesso não autorizado." }, { status: 403 });
        }

        const snapshot = getDataSnapshot("mapa-parque");
        const authorizedIds =
          user.role === "gn"
            ? new Set(user.partnerIds)
            : new Set(snapshot.partners.map((partner) => partner.id));
        const partners = snapshot.partners.filter((partner) => authorizedIds.has(partner.id));
        const scopes = Object.fromEntries(
          partners.flatMap((partner) => {
            const scope = snapshot.scopes[partner.id as keyof typeof snapshot.scopes];
            return scope ? [[partner.id, scope]] : [];
          }),
        );

        return Response.json(
          {
            source: snapshot.source,
            rules: snapshot.rules,
            partners,
            scopes,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
