"use server";

import type { AdminActionState } from "@/lib/admin";
import { fields, flag, list, sendAdmin, text } from "@/lib/server/admin";
import { apiFetch } from "@/lib/server/api";

export interface PaxTemplatePreview {
  code: string;
  name: string;
  channel: string;
  lang: string;
  reservation: string;
  recipient: string | null;
  subject: string | null;
  body: string;
  scheduled_at: string | null;
  eligible: boolean;
  blocked_reason: string | null;
  reservation_lang: string;
}

const PATH = "/admin/comunicaciones";

const body = (form: FormData) => ({
  ...fields(form, ["name", "event", "offset_hours", "subject", "body", "lang", "requires_rule"]),
  channels: list(form, "channels"),
  products: list(form, "products"),
  sales_channels: list(form, "sales_channels"),
  only_if_balance: flag(form, "only_if_balance"),
  only_if_missing_docs: flag(form, "only_if_missing_docs"),
});

const code = (form: FormData) => encodeURIComponent(text(form, "code") ?? "");

export async function createPaxTemplate(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin("/notifications/pax-templates", "POST", body(form), PATH, "No pudimos crear la plantilla.");
}

export async function updatePaxTemplate(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/notifications/pax-templates/${code(form)}`, "PATCH", body(form), PATH, "No pudimos guardar la plantilla.");
}

export async function togglePaxTemplate(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/notifications/pax-templates/${code(form)}`, "PATCH", { active: text(form, "active") === "1" }, PATH);
}

export async function deletePaxTemplate(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/notifications/pax-templates/${code(form)}`, "DELETE", {}, PATH, "No pudimos eliminar la plantilla.");
}

const message = (form: FormData) => encodeURIComponent(text(form, "message") ?? "");

export async function sendPaxMessage(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  const reservation = encodeURIComponent(text(form, "reservation") ?? "");
  return sendAdmin(`/reservations/${reservation}/pax-messages`, "POST", fields(form, ["channel", "template", "subject", "body", "scheduled_at"]), PATH, "No pudimos enviar el mensaje.");
}

export async function paxMessageStep(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  const step = text(form, "step");
  const path = step === "cancel" ? "cancel" : step === "retry" ? "retry" : "send-now";
  return sendAdmin(`/notifications/pax-messages/${message(form)}/${path}`, "POST", {}, PATH, "No pudimos actualizar el mensaje.");
}

export async function reschedulePaxMessages(): Promise<AdminActionState> {
  return sendAdmin("/notifications/pax-messages/reschedule", "POST", {}, PATH, "No pudimos recalcular la programación.");
}

export async function testPaxTemplate(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/notifications/pax-templates/${code(form)}/test`, "POST", {}, PATH, "No pudimos enviar la prueba.");
}

export async function duplicatePaxTemplate(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/notifications/pax-templates/${code(form)}/duplicate`, "POST", {}, PATH, "No pudimos duplicar la plantilla.");
}

export async function previewPaxTemplate(template: string, channel: string, reservation?: string): Promise<{ ok: true; data: PaxTemplatePreview } | { ok: false; message: string }> {
  const result = await apiFetch<PaxTemplatePreview>(`/notifications/pax-templates/${encodeURIComponent(template)}/preview`, { method: "POST", body: { channel, ...(reservation ? { reservation } : {}) } });
  if (!result.ok || !result.data) return { ok: false, message: result.error?.message ?? "No pudimos preparar la vista previa." };
  return { ok: true, data: result.data };
}
