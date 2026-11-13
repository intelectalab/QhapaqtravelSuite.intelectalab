import "server-only";
import { cache } from "react";
import type { Adapter, AdaptersMeta, ApiOverview, AuditEntry, IntegrationErrorRecord, IntegrationsOverview, NotificationMessageRecord, NotificationRuleRecord, NotificationRulesMeta, NotificationsOverview, PaxMessage, PaxTemplatesOverview, RulesOverview, ScheduledJob, SchedulerInfo } from "@/lib/admin";
import { getCollection } from "./admin";
import { getResource } from "./resource";

export const getNotifications = cache(async (): Promise<NotificationsOverview | null> => {
  const [rules, messages] = await Promise.all([
    getCollection<NotificationRuleRecord, NotificationRulesMeta>("/notifications/rules", "No pudimos cargar las reglas de aviso.", 100),
    getCollection<NotificationMessageRecord>("/notifications/messages", "No pudimos cargar el historial de envíos."),
  ]);
  if (!rules || !messages) return null;
  return {
    rules: rules.data.map((rule) => ({ ...rule, event: rule.event_code, updated_by: rule.updated_by_name, custom_templates: rule.custom_templates ?? {} })),
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
      body: message.body_rendered ?? null,
      address: message.recipient_address ?? null,
      read_at: message.read_at ?? null,
    })),
    kpis: rules.meta.kpis,
    options: rules.meta.options,
    history: rules.meta.history,
    can_manage: rules.meta.can_manage,
    whatsapp: rules.meta.whatsapp ?? null,
  };
});

export const getIntegrations = cache(async (): Promise<IntegrationsOverview | null> => {
  const [adapters, jobs, errors] = await Promise.all([
    getCollection<Adapter, AdaptersMeta>("/integrations", "No pudimos cargar las integraciones.", 100),
    getCollection<ScheduledJob, { scheduler?: SchedulerInfo }>("/jobs", "No pudimos cargar los procesos programados.", 100),
    getCollection<IntegrationErrorRecord>("/integration-errors", "No pudimos cargar los errores de integración.", 200),
  ]);
  if (!adapters || !jobs || !errors) return null;
  return {
    adapters: adapters.data,
    jobs: jobs.data,
    errors: errors.data.map((error) => ({ ...error, resolved_by: error.resolved_by_name })),
    owners: adapters.meta.owners,
    history: adapters.meta.history,
    can_manage: adapters.meta.can_manage,
    scheduler: jobs.meta.scheduler ?? null,
  };
});

export const getRules = cache(() => getResource<RulesOverview>("/admin/booking-rules", "No pudimos cargar las reglas."));

export const getRuleChanges = cache(async (): Promise<AuditEntry[] | null> => {
  const changes = await getCollection<AuditEntry>("/admin/booking-rules/audit", "No pudimos cargar el historial de reglas.", 300);
  return changes ? changes.data : null;
});

export const getPassengerMessaging = cache(async (): Promise<{ data: PaxTemplatesOverview; messages: PaxMessage[] } | null> => {
  const [data, messages] = await Promise.all([
    getResource<PaxTemplatesOverview>("/notifications/pax-templates", "No pudimos cargar las plantillas."),
    getCollection<PaxMessage>("/notifications/pax-messages", "No pudimos cargar los mensajes al pasajero.", 500),
  ]);
  if (!data || !messages) return null;
  return { data, messages: messages.data };
});

export const getApiAccess = cache(() => getResource<ApiOverview>("/admin/api", "No pudimos cargar la API."));
