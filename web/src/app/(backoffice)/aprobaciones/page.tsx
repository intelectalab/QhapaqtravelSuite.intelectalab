import { AlarmClock, CircleCheckBig, Send, UserCheck } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { ApprovalsWorkspace, NewApprovalAction } from "@/features/approvals/ApprovalsWorkspace";
import type { ApprovalsOverview } from "@/lib/approvals";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Bandeja de aprobaciones" };

export default async function AprobacionesPage() {
  const overview = await getResource<ApprovalsOverview>("/approvals", "No pudimos cargar la bandeja de aprobaciones.");

  if (!overview) {
    return <PageHeader title="Bandeja de aprobaciones" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const { kpis } = overview;

  return (
    <>
      <PageHeader
        title="Bandeja de aprobaciones"
        subtitle="Cotizaciones fuera de política, anulaciones, cambios de reserva y lo que piden agencias y proveedores, en un solo lugar."
        info={<InfoTip>Aprobar o rechazar aquí ejecuta el mismo efecto que en el módulo de origen. Quien pide una aprobación nunca la decide.</InfoTip>}
        actions={overview.can.create ? <NewApprovalAction types={overview.types} /> : undefined}
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={UserCheck} tone="t1" label="Para mí" value={kpis.for_me} note="Esperan tu decisión" />
        <TintTile icon={AlarmClock} tone="bad" label="Fuera de plazo" value={kpis.overdue} note="Plazo de respuesta vencido" />
        <TintTile icon={Send} tone="violet" label="Enviadas por mí" value={kpis.sent_open} note="Aún sin respuesta" />
        <TintTile icon={CircleCheckBig} tone="ok" label="Resueltas en 7 días" value={kpis.resolved_week} note={kpis.avg_hours !== null ? `${kpis.avg_hours} h en promedio` : "Sin decisiones recientes"} />
      </section>
      <ApprovalsWorkspace overview={overview} />
    </>
  );
}
