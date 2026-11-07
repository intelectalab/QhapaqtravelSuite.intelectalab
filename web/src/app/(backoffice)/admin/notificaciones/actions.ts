"use server";

import type { AdminActionState } from "@/lib/admin";
import type { NotificationTemplate, TemplateChannel, TemplateResult } from "@/lib/notificationTemplates";
import { fields, flag, sendAdmin, text } from "@/lib/server/admin";
import { apiFetch } from "@/lib/server/api";

const templatePath = (event: string, channel: TemplateChannel) => `/notifications/templates/${encodeURIComponent(event)}/${encodeURIComponent(channel)}`;

const failure = (error: { message: string; errors?: Record<string, string[]> } | null, fallback: string) => (error?.errors ? Object.values(error.errors)[0]?.[0] : undefined) ?? error?.message ?? fallback;

export async function loadTemplate(event: string, channel: TemplateChannel): Promise<TemplateResult> {
  const result = await apiFetch<NotificationTemplate>(templatePath(event, channel));
  return result.ok && result.data ? { template: result.data, message: null } : { template: null, message: failure(result.error, "No pudimos cargar la plantilla.") };
}

export async function saveTemplate(event: string, channel: TemplateChannel, subject: string, body: string): Promise<TemplateResult> {
  const result = await apiFetch<NotificationTemplate>(templatePath(event, channel), { method: "PUT", body: { subject, body } });
  return result.ok && result.data ? { template: result.data, message: null, notice: `Guardamos la versión ${result.data.version}. Los próximos avisos ya la usan.` } : { template: null, message: failure(result.error, "No pudimos guardar la plantilla.") };
}

export async function restoreTemplate(event: string, channel: TemplateChannel): Promise<TemplateResult> {
  const result = await apiFetch(templatePath(event, channel), { method: "DELETE", body: {} });
  if (!result.ok) return { template: null, message: failure(result.error, "No pudimos restaurar la plantilla.") };
  const fresh = await loadTemplate(event, channel);
  return { ...fresh, notice: fresh.template ? "Volvimos a la plantilla del sistema." : null };
}

export async function testTemplate(event: string, channel: TemplateChannel, subject: string, body: string): Promise<TemplateResult> {
  const result = await apiFetch<{ message: { to: string | null; status: string }; template: NotificationTemplate }>(`${templatePath(event, channel)}/test`, { method: "POST", body: { subject, body } });
  if (!result.ok || !result.data) return { template: null, message: failure(result.error, "No pudimos enviar la prueba.") };
  const sent = result.data.message;
  return { template: result.data.template, message: null, notice: sent.status === "fallido" ? "La prueba quedó registrada como fallida: revisa tu contacto en tu usuario." : `Enviamos la prueba${sent.to ? ` a ${sent.to}` : ""}. Aparece también en el historial de envíos.` };
}

const PATH = "/admin/notificaciones";

const message = (form: FormData) => encodeURIComponent(text(form, "code") ?? "");

export async function updateNotificationRule(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  const body = {
    ...fields(form, ["recipients", "timing", "condition"]),
    ch_email: flag(form, "email"),
    ch_whatsapp: flag(form, "whatsapp"),
    ch_push: flag(form, "push"),
    ch_portal: flag(form, "portal"),
  };
  return sendAdmin(`/notifications/rules/${encodeURIComponent(text(form, "event") ?? "")}`, "PATCH", body, PATH, "No pudimos guardar la regla.");
}

export async function retryNotification(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/notifications/messages/${message(form)}/retry`, "POST", {}, PATH, "No pudimos reintentar el envío.");
}

export async function fallbackNotification(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/notifications/messages/${message(form)}/fallback`, "POST", {}, PATH, "No pudimos reenviar por correo.");
}
