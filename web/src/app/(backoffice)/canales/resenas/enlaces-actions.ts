"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";
import { sendStep, type StepResult } from "@/lib/server/resource";

export async function saveReviewLinks(_state: StepResult, form: FormData): Promise<StepResult> {
  const value = (key: string) => {
    const raw = String(form.get(key) ?? "").trim();
    return raw === "" ? null : raw;
  };
  const result = await sendStep("/channels/review-links", "PUT", { google: value("google"), tripadvisor: value("tripadvisor"), lock_version: Number(form.get("lock_version") ?? 0) }, "No pudimos guardar los enlaces de reseñas.");
  if (result.done) revalidatePath("/canales/resenas", "layout");
  return result;
}

export async function testReviewLink(platform: string, url: string): Promise<{ ok: boolean; message: string }> {
  const result = await apiFetch<{ ok: boolean; message: string }>("/channels/review-links/test", { method: "POST", body: { platform, url } });
  if (!result.ok || !result.data) {
    const first = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { ok: false, message: first ?? result.error?.message ?? "No pudimos probar el enlace." };
  }
  return result.data;
}
