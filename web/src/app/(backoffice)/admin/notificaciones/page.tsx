import { BellRing, Inbox } from "lucide-react";
import type { Metadata } from "next";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle } from "@/components/ui/Tinted";
import { AuditTrail } from "@/features/admin/AdminParts";
import { NotificationLog, NotificationMatrix } from "@/features/admin/Notifications";
import type { NotificationsOverview } from "@/lib/admin";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Notificaciones" };

export default async function NotificacionesPage() {
  const data = await getResource<NotificationsOverview>("/admin/notifications", "No pudimos cargar las notificaciones.");
  if (!data) return <NoAccess home="/dashboard" />;

  return (
    <>
      <PageHeader
        title="Notificaciones"
        subtitle={`${data.kpis.routes} avisos configurados entre ${data.rules.length} eventos y 4 canales · ${data.kpis.sent_7d} enviados en los últimos 7 días.`}
        info={<InfoTip>Un fallo de envío nunca deshace la operación que lo originó. Los errores temporales se reintentan; los permanentes, como un número no registrado en WhatsApp, necesitan corregir el destinatario.</InfoTip>}
      />
      <Card className="mb-5">
        <TintCardTitle icon={BellRing} title="Qué se avisa y por dónde" aside={`${data.rules.length} eventos`} />
        <NotificationMatrix data={data} />
      </Card>
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
        <Inbox size={17} className="text-accent" />
        Historial de envíos
      </h2>
      <NotificationLog data={data} />
      <div className="mt-5">
        <AuditTrail entries={data.history} empty="Las reglas de aviso aún no tienen cambios." />
      </div>
    </>
  );
}
