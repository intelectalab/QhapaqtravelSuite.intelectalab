"use server";

import { revalidatePath } from "next/cache";
import type { AdminActionState } from "@/lib/admin";
import { apiFetch } from "@/lib/server/api";

export async function saveWhatsappWebhook(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  const clear = form.get("clear") === "on";
  const token = String(form.get("verify_token") ?? "").trim();
  const result = await apiFetch("/platform/settings/whatsapp-webhook", { method: "PUT", body: clear ? { clear: true } : { verify_token: token }, realm: "platform" });
  if (!result.ok) {
    const first = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { done: false, message: first ?? result.error?.message ?? "No pudimos guardar el token de WhatsApp." };
  }
  revalidatePath("/plataforma", "layout");
  return { done: true, message: null };
}
