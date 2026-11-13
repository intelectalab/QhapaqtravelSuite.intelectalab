import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { SalesTeamsBoard, TargetPolicyCard } from "@/features/targets/SalesTeams";
import { getResource } from "@/lib/server/resource";
import type { SalesTeamsOverview } from "@/lib/targets";

export const metadata: Metadata = { title: "Equipos y bonos" };

export default async function SalesTeamsPage() {
  const overview = await getResource<SalesTeamsOverview>("/crm/sales-teams", "No pudimos cargar los equipos comerciales.");

  if (!overview) {
    return <PageHeader back={{ href: "/crm/metas", label: "Metas comerciales" }} title="Equipos y bonos" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  return (
    <>
      <PageHeader
        back={{ href: "/crm/metas", label: "Metas comerciales" }}
        title="Equipos y bonos"
        subtitle="Quién vende en cada equipo y cuánto del bono se paga según el cumplimiento."
        info={<InfoTip>Las metas de equipo suman las reservas de sus integrantes vigentes en el período. Los tramos de bono se aplican a las metas individuales al cerrar el período.</InfoTip>}
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <SalesTeamsBoard overview={overview} />
        <TargetPolicyCard overview={overview} />
      </div>
    </>
  );
}
