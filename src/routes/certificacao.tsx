import { createFileRoute } from "@tanstack/react-router";
import { CertificationPanel } from "@/components/CertificationPanel";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { usePartnerFilter } from "@/contexts/AppContexts";
import { usePartners } from "@/hooks/useData";

export const Route = createFileRoute("/certificacao")({
  head: () => ({ meta: [{ title: "Certificação — Mapa Parque" }] }),
  component: CertificationPage,
});

function CertificationPage() {
  const { effectiveSelected, selected, role, allowedPartnerIds } = usePartnerFilter();
  const { data: partners = [] } = usePartners();
  const candidatePartnerId = effectiveSelected.length === 1 ? effectiveSelected[0] : null;
  const activePartner = partners.find((partner) => partner.id === candidatePartnerId) ?? null;
  const allowedCount = allowedPartnerIds?.length ?? 0;

  /**
   * Cabeçalho funcional: nome da página e o recorte realmente em uso. A Certificação
   * é individual por PV, então o recorte informa o parceiro do ciclo, não uma lista.
   */
  const scopeLabel = activePartner
    ? activePartner.name
    : selected.length > 1
      ? `${selected.length} parceiros selecionados`
      : role === "gn" && selected.length === 0
        ? `${allowedCount} ${allowedCount === 1 ? "parceiro autorizado" : "parceiros autorizados"}`
        : "Nenhum parceiro selecionado";

  return (
    <DashboardLayout title="Certificação">
      <header className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between lg:gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold leading-[1.2] tracking-tight text-foreground md:text-[28px] md:leading-[34px]">
            Certificação
          </h1>
          <dl className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <div className="flex min-w-0 items-baseline gap-1.5">
              <dt className="font-medium text-foreground">PV:</dt>
              <dd className="min-w-0 truncate" title={activePartner?.name}>
                {scopeLabel}
              </dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt className="font-medium text-foreground">Ciclos:</dt>
              <dd>1º semestre fechado · 2º semestre em simulação</dd>
            </div>
          </dl>
        </div>
      </header>
      <CertificationPanel />
    </DashboardLayout>
  );
}
