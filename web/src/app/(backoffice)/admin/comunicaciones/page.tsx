import { AlertTriangle } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { ToneScope } from "@/components/ui/Tinted";
import { AuditTrail } from "@/features/admin/AdminParts";
import { PaxTemplateCreateAction, PaxTemplatesTable, VariablesCard } from "@/features/admin/PaxTemplates";
import type { PaxTemplatesOverview } from "@/lib/admin";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Mensajes al pasajero" };

export default async function ComunicacionesPage() {
  const data = await getResource<PaxTemplatesOverview>("/admin/pax-templates", "No pudimos cargar las plantillas.");
  if (!data) return <NoAccess home="/dashboard" />;
  const active = data.templates.filter((template) => template.active).length;

  return (
    <>
      <PageHeader
        title="Mensajes al pasajero"
        subtitle={`${active} de ${data.templates.length} plantillas activas acompañan cada viaje, desde la confirmación hasta la encuesta final.`}
        info={<InfoTip>Cada plantilla se programa sola para las reservas vigentes: momento del viaje más el desfase. Solo admite las variables de la lista; WhatsApp necesita plantillas aprobadas por Meta y hasta 1 024 caracteres.</InfoTip>}
        actions={data.can_manage ? <PaxTemplateCreateAction data={data} /> : undefined}
      />
      {!data.messages_enabled && (
        <ToneScope tone="warn" className="mb-4 flex items-center gap-2.5 rounded-[12px] bg-[color-mix(in_srgb,var(--tint)_10%,var(--surface))] px-4 py-3 text-[13px]">
          <AlertTriangle size={17} className="flex-none text-[var(--tint)]" />
          <span>
            La regla de mensajes automáticos está apagada: no se programa ningún envío. Actívala en{" "}
            <Link href="/admin/reglas" className="font-semibold text-accent hover:underline">
              Reglas de reserva
            </Link>
            .
          </span>
        </ToneScope>
      )}
      <PaxTemplatesTable data={data} />
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <VariablesCard data={data} />
        <AuditTrail entries={data.history} empty="Las plantillas aún no tienen cambios." />
      </div>
    </>
  );
}
