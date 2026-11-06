import { BellRing, Inbox } from "lucide-react";
import type { Metadata } from "next";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle } from "@/components/ui/Tinted";
import { AuditTrail } from "@/features/admin/AdminParts";
import { NotificationLog, NotificationMatrix } from "@/features/admin/Notifications";
import type { NotificationMessageRecord, NotificationRuleRecord, NotificationRulesMeta, NotificationsOverview } from "@/lib/admin";
import { getCollection } from "@/lib/server/admin";

export const metadata: Metadata = { title: "Notificaciones" };

export default async function NotificacionesPage() {
  const [rules, messages] = await Promise.all([
    getCollection<NotificationRuleRecord, NotificationRulesMeta>("/notifications/rules", "No pudimos cargar las reglas de aviso.", 100),
    getCollection<NotificationMessageRecord>("/notifications/messages", "No pudimos cargar el historial de envíos."),
  ]);
  if (!rules || !messages) return <NoAccess home="/dashboard" />;
  const data: NotificationsOverview = {
    rules: rules.data.map((rule) => ({ ...rule, event: rule.event_code, updated_by: rule.updated_by_name })),
    messages: messages.data.map((message) => ({
      code: message.code,
      event: message.event_code,
      event_label: message.event_label,
      channel: message.channel,
      to: message.to,
      subject: message.subject,
      status: message.status,
      retries: message.retries,
      error: message.last_error,
      permanent: message.permanent,
      fallback: message.is_fallback,
      can_fallback: message.can_fallback,
      audience: message.audience,
      at: message.created_at,
      sent_at: message.sent_at,
    })),
    kpis: rules.meta.kpis,
    options: rules.meta.options,
    history: rules.meta.history,
    can_manage: rules.meta.can_manage,
  };

  return (
    <>
      <PageHeader
        title="Notificaciones"
        subtitle={`${data.kpis.routes} avisos configurados entre ${data.rules.length} eventos y 4 canales · ${data.kpis.sent_7d} enviados en los últimos 7 días.`}
        info={<InfoTip>Un fallo de envío nunca deshace la operación que lo originó. Los errores temporales se reintentan; los permanentes, como un número no registrado en WhatsApp, se pueden reenviar por correo.</InfoTip>}
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
