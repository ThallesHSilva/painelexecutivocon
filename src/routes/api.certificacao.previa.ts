import { createFileRoute } from "@tanstack/react-router";
import { isSameOriginRequest, readAuthUser } from "@/lib/auth.server";
import { getCertificationPreview, saveCertificationPreview } from "@/lib/database.server";
import { getDataSnapshot } from "@/lib/snapshots.server";

function canAccessPartner(
  partnerId: string,
  user: NonNullable<Awaited<ReturnType<typeof readAuthUser>>>,
) {
  const partnerExists = getDataSnapshot("mapa-parque").partners.some(
    (partner) => partner.id === partnerId,
  );
  if (!partnerExists) return false;
  return user.role === "director" || (user.role === "gn" && user.partnerIds.includes(partnerId));
}

export const Route = createFileRoute("/api/certificacao/previa")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await readAuthUser();
        const partnerId = new URL(request.url).searchParams.get("partnerId")?.trim() ?? "";
        if (!user || user.role === "admin" || !canAccessPartner(partnerId, user)) {
          return Response.json({ message: "Acesso não autorizado." }, { status: 403 });
        }
        return Response.json(
          { preview: getCertificationPreview(partnerId) },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
      PUT: async ({ request }) => {
        const user = await readAuthUser();
        if (!user || user.role === "admin") {
          return Response.json({ message: "Acesso não autorizado." }, { status: 403 });
        }
        if (!isSameOriginRequest(request)) {
          return Response.json({ message: "Origem não permitida." }, { status: 403 });
        }
        const body = (await request.json()) as { partnerId?: unknown; payload?: unknown };
        const partnerId = typeof body.partnerId === "string" ? body.partnerId.trim() : "";
        if (!partnerId || body.payload === undefined || !canAccessPartner(partnerId, user)) {
          return Response.json({ message: "Solicitação inválida." }, { status: 400 });
        }
        const serialized = JSON.stringify(body.payload);
        if (serialized.length > 250_000) {
          return Response.json({ message: "Prévia excede o tamanho permitido." }, { status: 413 });
        }
        const saved = saveCertificationPreview({
          partnerId,
          payload: body.payload,
          updatedBy: user.email,
        });
        return Response.json(
          { saved: true, ...saved },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
