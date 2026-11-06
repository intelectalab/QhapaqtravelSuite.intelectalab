"use server";

import type { AdminActionState } from "@/lib/admin";
import { fields, flag, sendAdmin, text } from "@/lib/server/admin";

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
