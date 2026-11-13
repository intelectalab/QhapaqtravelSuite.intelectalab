"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";
import type { StepResult } from "@/lib/server/resource";

const MAX_SIGNATURE_BYTES = 1024 * 1024;

export async function signWaiver(_state: StepResult, form: FormData): Promise<StepResult> {
  const signature = String(form.get("signature") ?? "");
  const match = signature.match(/^data:image\/png;base64,(.+)$/);
  if (!match) return { message: "Dibuja tu firma antes de enviar.", done: false };
  const bytes = Buffer.from(match[1], "base64");
  if (bytes.length > MAX_SIGNATURE_BYTES) return { message: "La firma es demasiado grande. Vuelve a dibujarla.", done: false };
  const payload = new FormData();
  for (const field of ["passenger_id", "template_code", "signed_name", "guardian_name"]) {
    const value = String(form.get(field) ?? "").trim();
    if (value !== "") payload.set(field, value);
  }
  payload.set("file", new Blob([bytes], { type: "image/png" }), "firma.png");
  const result = await apiFetch("/portal/passenger/waivers", { method: "POST", form: payload });
  if (!result.ok) {
    const first = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: first ?? result.error?.message ?? "No pudimos registrar tu firma.", done: false };
  }
  revalidatePath("/portal/mi-pase");
  return { message: null, done: true };
}
