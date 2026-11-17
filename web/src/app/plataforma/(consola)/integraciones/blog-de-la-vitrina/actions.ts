"use server";

import { revalidatePath } from "next/cache";
import type { AdminActionState } from "@/lib/admin";
import { apiFetch, type ApiResult } from "@/lib/server/api";

const PATH = "/plataforma/integraciones/blog-de-la-vitrina";

const failure = (error: ApiResult<unknown>["error"], fallback: string): AdminActionState => ({ done: false, message: (error?.errors ? Object.values(error.errors)[0]?.[0] : undefined) ?? error?.message ?? fallback });

export async function savePayloadAdminUrl(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  const result = await apiFetch("/platform/integrations/payload", { method: "PUT", body: { admin_url: String(form.get("admin_url") ?? "").trim() }, realm: "platform" });
  if (!result.ok) return failure(result.error, "No pudimos guardar la URL del admin de Payload.");
  revalidatePath(PATH);
  return { done: true, message: null };
}

export async function generatePayloadSecret(): Promise<AdminActionState> {
  const result = await apiFetch<{ secret: string; rotated: boolean }>("/platform/integrations/payload/secret", { method: "POST", body: {}, realm: "platform" });
  if (!result.ok || !result.data) return failure(result.error, "No pudimos generar la clave de firma.");
  revalidatePath(PATH);
  revalidatePath("/plataforma/marketing-vitrina/blog");
  return { done: true, message: null, secret: result.data.secret, label: result.data.rotated ? "rotada" : "generada" };
}
