"use server";

import type { AdminActionState } from "@/lib/admin";
import { fields, flag, sendAdmin, text } from "@/lib/server/admin";

const PATH = "/admin/notificaciones";

export async function updateNotificationRule(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  const body = {
    ...fields(form, ["recipients", "timing", "condition"]),
    email: flag(form, "email"),
    whatsapp: flag(form, "whatsapp"),
    push: flag(form, "push"),
    portal: flag(form, "portal"),
  };
  return sendAdmin(`/admin/notifications/rules/${encodeURIComponent(text(form, "event") ?? "")}`, "PATCH", body, PATH, "No pudimos guardar la regla.");
}

export async function retryNotification(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/admin/notifications/messages/${encodeURIComponent(text(form, "code") ?? "")}/retry`, "POST", {}, PATH, "No pudimos reintentar el envío.");
}
