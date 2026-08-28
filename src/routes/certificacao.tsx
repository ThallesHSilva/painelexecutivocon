import { createFileRoute } from "@tanstack/react-router";
import { CertificationPanel } from "@/components/CertificationPanel";
import { DashboardLayout } from "@/layouts/DashboardLayout";

export const Route = createFileRoute("/certificacao")({
  head: () => ({ meta: [{ title: "Certificação — Mapa Parque" }] }),
  component: CertificationPage,
});

function CertificationPage() {
  return (
    <DashboardLayout title="Certificação">
      <CertificationPanel />
    </DashboardLayout>
  );
}
