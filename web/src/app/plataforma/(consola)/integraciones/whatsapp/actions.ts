"use server";

import { revalidatePath } from "next/cache";
import type { AdminActionState } from "@/lib/admin";
import { apiFetch } from "@/lib/server/api";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

async function send(method: "PUT" | "POST", path: string, body: Record<string, unknown>, failure: string): Promise<AdminActionState> {
  const result = await apiFetch(`/platform/integrations/whatsapp${path}`, { method, body, realm: "platform" });
  if (!result.ok) {
    const first = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { done: false, message: first ?? result.error?.message ?? failure };
  }
  revalidatePath("/plataforma/integraciones/whatsapp");
  return { done: true, message: null };
}

export async function saveWhatsappApp(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  const body: Record<string, unknown> = { app_id: text(form, "app_id"), config_id: text(form, "config_id"), api_version: text(form, "api_version") };
  for (const secret of ["app_secret", "verify_token"]) {
    if (text(form, secret) !== "") body[secret] = text(form, secret);
  }
  return send("PUT", "", body, "No pudimos guardar la app de Meta.");
}

export async function testWhatsappApp(): Promise<AdminActionState> {
  const result = await apiFetch<{ test: { ok: boolean; message: string } }>("/platform/integrations/whatsapp/test", { method: "POST", body: {}, realm: "platform" });
  revalidatePath("/plataforma/integraciones/whatsapp");
  if (!result.ok) return { done: false, message: result.error?.message ?? "No pudimos probar la app de Meta." };
  return result.data?.test.ok ? { done: true, message: null } : { done: false, message: result.data?.test.message ?? "Meta no reconoció la app." };
}
