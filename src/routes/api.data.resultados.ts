import { createFileRoute } from "@tanstack/react-router";
import { readAuthUser } from "@/lib/auth.server";
import { buildAuthorizedResultsPayload } from "@/lib/results-access";
import { getDataSnapshot } from "@/lib/snapshots.server";

export const Route = createFileRoute("/api/data/resultados")({
  server: {
    handlers: {
      GET: async () => {
        const user = await readAuthUser();
        if (!user || user.role === "admin") {
          return Response.json({ message: "Acesso não autorizado." }, { status: 403 });
        }

        const mapa = getDataSnapshot("mapa-parque");
        const resultados = getDataSnapshot("resultados-yoy");
        const bestGuess = getDataSnapshot("best-guess");
        const portabilidade = getDataSnapshot("portabilidade-analitica");
        return Response.json(
          buildAuthorizedResultsPayload(user, {
            mapa,
            resultados,
            bestGuess,
            portabilidade,
            torres: getDataSnapshot("torres-servico"),
          }),
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
