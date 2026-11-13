import { Users } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/Button";
import { InfoTip } from "@/components/ui/InfoTip";
import { TargetCreateAction } from "@/features/targets/TargetForms";
import { TargetsWorkspace } from "@/features/targets/TargetsWorkspace";
import { getResource } from "@/lib/server/resource";
import type { TargetsOverview } from "@/lib/targets";

export const metadata: Metadata = { title: "Metas comerciales" };

export default async function MetasPage() {
  const overview = await getResource<TargetsOverview>("/crm/sales-targets", "No pudimos cargar las metas.");

  if (!overview) {
    return <PageHeader title="Metas comerciales" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  return (
    <>
      <PageHeader
        title="Metas comerciales"
        subtitle={overview.can.manage ? "Avance real de cada asesor, equipo y sede contra lo vendido." : "Tu avance del período y tu posición en el equipo."}
        info={<InfoTip>La proyección suma lo vendido y las oportunidades abiertas que cierran en el período, ponderadas por su probabilidad. Al cerrar el período el resultado se congela.</InfoTip>}
        actions={
          overview.can.manage ? (
            <>
              <Button href="/crm/metas/equipos" variant="secondary" icon={<Users size={16} />} iconOnlyOnMobile>
                Equipos y bonos
              </Button>
              {overview.options && <TargetCreateAction options={overview.options} targets={overview.targets} />}
            </>
          ) : undefined
        }
      />
      <TargetsWorkspace overview={overview} />
    </>
  );
}
