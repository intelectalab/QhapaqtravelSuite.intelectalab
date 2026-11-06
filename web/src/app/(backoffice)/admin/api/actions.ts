"use server";

import type { AdminActionState } from "@/lib/admin";
import { fields, list, sendAdmin, text } from "@/lib/server/admin";

const PATH = "/admin/api";

const code = (form: FormData) => encodeURIComponent(text(form, "code") ?? "");

export async function createApiKey(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  const ips = (text(form, "ips") ?? "").split(/[\s,]+/).filter(Boolean);
  return sendAdmin("/admin/api/keys", "POST", { ...fields(form, ["name", "environment", "expires_at"]), scopes: list(form, "scopes"), ips }, PATH, "No pudimos crear la clave.");
}

export async function revokeApiKey(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/admin/api/keys/${code(form)}/revoke`, "POST", { reason: text(form, "reason") }, PATH, "No pudimos revocar la clave.");
}

export async function createWebhook(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin("/admin/api/webhooks", "POST", { ...fields(form, ["url", "description"]), events: list(form, "events") }, PATH, "No pudimos crear el webhook.");
}

export async function updateWebhook(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/admin/api/webhooks/${code(form)}`, "PATCH", { ...fields(form, ["url", "description"]), events: list(form, "events") }, PATH, "No pudimos guardar el webhook.");
}

export async function setWebhookStatus(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  const mode = text(form, "mode") === "resume" ? "resume" : "pause";
  return sendAdmin(`/admin/api/webhooks/${code(form)}/${mode}`, "POST", {}, PATH);
}

export async function deleteWebhook(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/admin/api/webhooks/${code(form)}`, "DELETE", {}, PATH, "No pudimos eliminar el webhook.");
}
