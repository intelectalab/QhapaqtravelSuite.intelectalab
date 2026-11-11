"use server";

import type { AdminActionState, WebhookDeliveryDetail } from "@/lib/admin";
import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";
import { fields, list, sendAdmin, text } from "@/lib/server/admin";

const PATH = "/admin/api";

const code = (form: FormData) => encodeURIComponent(text(form, "code") ?? "");

export async function createApiKey(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  const ips = (text(form, "ips") ?? "").split(/[\s,]+/).filter(Boolean);
  return sendAdmin("/integrations/api-keys", "POST", { ...fields(form, ["name", "environment", "expires_at"]), scopes: list(form, "scopes"), ips }, PATH, "No pudimos crear la clave.");
}

export async function revokeApiKey(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/integrations/api-keys/${code(form)}`, "DELETE", { reason: text(form, "reason") }, PATH, "No pudimos revocar la clave.");
}

export async function createWebhook(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin("/integrations/webhooks", "POST", { ...fields(form, ["url", "description"]), events: list(form, "events") }, PATH, "No pudimos crear el webhook.");
}

export async function updateWebhook(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/integrations/webhooks/${code(form)}`, "PATCH", { ...fields(form, ["url", "description"]), events: list(form, "events") }, PATH, "No pudimos guardar el webhook.");
}

export async function setWebhookStatus(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  const status = text(form, "mode") === "resume" ? "active" : "paused";
  return sendAdmin(`/integrations/webhooks/${code(form)}`, "PATCH", { status }, PATH);
}

export async function deleteWebhook(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/integrations/webhooks/${code(form)}`, "DELETE", {}, PATH, "No pudimos eliminar el webhook.");
}

export async function rotateWebhookSecret(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/integrations/webhooks/${code(form)}/rotate-secret`, "POST", {}, PATH, "No pudimos rotar el secreto.");
}

export async function pingWebhook(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  const result = await apiFetch<{ status: string; http: number | null; ms: number; error: string | null }>(`/integrations/webhooks/${code(form)}/ping`, { method: "POST", body: {} });
  revalidatePath(PATH, "layout");
  if (!result.ok || !result.data) return { message: (result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined) ?? result.error?.message ?? "No pudimos enviar el ping.", done: false };
  if (result.data.status !== "delivered") return { message: `El destino no confirmó el ping: ${result.data.error ?? "sin respuesta"}${result.data.http ? ` (HTTP ${result.data.http})` : ""}.`, done: false };
  return { message: null, done: true };
}

export async function redeliverWebhook(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/integrations/webhook-deliveries/${code(form)}/redeliver`, "POST", {}, PATH, "No pudimos reenviar la entrega.");
}

export async function loadDelivery(delivery: string): Promise<WebhookDeliveryDetail | null> {
  const result = await apiFetch<WebhookDeliveryDetail>(`/integrations/webhook-deliveries/${encodeURIComponent(delivery)}`);
  return result.ok && result.data ? result.data : null;
}
