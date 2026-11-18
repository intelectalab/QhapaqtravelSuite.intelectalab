import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { ToneScope } from "@/components/ui/Tinted";
import { PaxTemplateCreateAction } from "@/features/admin/PaxTemplates";
import { getPassengerMessaging } from "@/lib/server/adminSections";

const BASE = "/admin/comunicaciones";

export default async function ComunicacionesLayout({ children }: { children: ReactNode }) {
  const loaded = await getPassengerMessaging();
  if (!loaded) return <NoAccess home="/dashboard" />;
  const { data, messages } = loaded;
  const scheduled = messages.filter((message) => message.status === "programado");

  return (
    <>
      <PageHeader
        title="Mensajes al pasajero"
        subtitle="Mensajes que acompañan cada viaje, desde la confirmación hasta la encuesta final: plantillas, programación e historial de entrega."
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
      <TabbedCard
        tabs={[
          { href: BASE, label: "Plantillas", count: data.templates.length },
          { href: `${BASE}/proximos`, label: "Próximos envíos", count: scheduled.length },
          { href: `${BASE}/historial`, label: "Historial", count: messages.length - scheduled.length },
        ]}
      >
        {children}
      </TabbedCard>
    </>
  );
}
