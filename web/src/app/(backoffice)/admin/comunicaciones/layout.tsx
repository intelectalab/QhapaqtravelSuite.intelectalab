import { AlertTriangle, Eye, Luggage, Timer } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { TintTile, ToneScope } from "@/components/ui/Tinted";
import { KpiGrid } from "@/features/admin/AdminParts";
import { PaxTemplateCreateAction } from "@/features/admin/PaxTemplates";
import { formatDateTime, formatPercent } from "@/lib/format";
import { getPassengerMessaging } from "@/lib/server/adminSections";

const BASE = "/admin/comunicaciones";

export default async function ComunicacionesLayout({ children }: { children: ReactNode }) {
  const loaded = await getPassengerMessaging();
  if (!loaded) return <NoAccess home="/dashboard" />;
  const { data, messages } = loaded;
  const scheduled = messages.filter((message) => message.status === "programado");
  const outgoing = messages.filter((message) => message.direction === "saliente" && ["enviado", "entregado", "leido", "fallido"].includes(message.status));
  const read = outgoing.filter((message) => message.status === "leido").length;
  const next = [...scheduled].filter((message) => message.scheduled_at).sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""))[0];
  const reservations = new Set(messages.map((message) => message.reservation).filter(Boolean)).size;

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
      <KpiGrid columns={3}>
        <TintTile icon={Eye} tone="ok" label="Tasa de lectura" value={outgoing.length > 0 ? formatPercent((read / outgoing.length) * 100, 0) : "Sin envíos"} note="De los mensajes que ya salieron" info={<p>Mensajes salientes con acuse de lectura entre todos los que ya salieron, entregados, leídos o fallidos.</p>} />
        <TintTile icon={Timer} tone="info" label="Próximo envío" value={next?.scheduled_at ? formatDateTime(next.scheduled_at, false) : "Nada programado"} note={next ? `${next.template_name ?? "Mensaje"}${next.reservation ? ` · ${next.reservation}` : ""}` : undefined} info={<p>El mensaje programado que sale primero, con su plantilla y su reserva.</p>} />
        <TintTile icon={Luggage} tone="t4" label="Reservas acompañadas" value={reservations} note="Con al menos un mensaje" info={<p>Reservas distintas que tienen mensajes programados, enviados o respondidos por el pasajero.</p>} />
      </KpiGrid>
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
