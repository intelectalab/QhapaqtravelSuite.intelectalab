"use server";

import { revalidatePath } from "next/cache";
import type { AdminActionState } from "@/lib/admin";
import { apiFetch } from "@/lib/server/api";

export async function saveFiscalWebhook(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  const clear = form.get("clear") === "on";
  const secret = String(form.get("webhook_secret") ?? "").trim();
  const result = await apiFetch("/platform/settings/fiscal-webhook", { method: "PUT", body: clear ? { clear: true } : { webhook_secret: secret }, realm: "platform" });
  if (!result.ok) {
    const first = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { done: false, message: first ?? result.error?.message ?? "No pudimos guardar el secreto del webhook fiscal." };
  }
  revalidatePath("/plataforma", "layout");
  return { done: true, message: null };
}
