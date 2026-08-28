import { createFileRoute } from "@tanstack/react-router";
import { readAuthUser } from "@/lib/auth.server";
import { getDataSnapshot } from "@/lib/snapshots.server";

function normalizeCompany(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toLowerCase();
}

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
        const torres = getDataSnapshot("torres-servico");
        const authorizedNames =
          user.role === "gn"
            ? new Set(
                mapa.partners
                  .filter((partner) => user.partnerIds.includes(partner.id))
                  .map((partner) => normalizeCompany(partner.name)),
              )
            : null;
        const canSeeCompany = (company: string) =>
          authorizedNames === null || authorizedNames.has(normalizeCompany(company));
        const bestGuessRecords = bestGuess.records.filter((record) => canSeeCompany(record.company));
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

        return Response.json(
          {
            resultados: {
              source: resultados.source,
              records: resultados.records.filter((record) => canSeeCompany(record.company)),
            },
            bestGuess: {
              source: bestGuess.source,
              records: bestGuessRecords,
              total: bestGuessTotal,
            },
            portabilidade: {
              source: portabilidade.source,
              records: portabilidade.records.filter((record) => canSeeCompany(record.company)),
            },
            torres,
          },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
    },
  },
});
