"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const done = (result: StepResult) => {
  if (result.done) revalidatePath("/canales/resenas-propias");
  return result;
};

const code = (form: FormData) => encodeURIComponent(String(form.get("code") ?? ""));

const MODERATION: Record<string, string> = { publicar: "publish", ocultar: "hide", rechazar: "reject" };

export async function moderateReview(_state: StepResult, form: FormData): Promise<StepResult> {
  return done(await sendStep(`/reviews/${code(form)}/${MODERATION[String(form.get("action") ?? "")] ?? "publish"}`, "POST", formValues(form, ["reason", "lock_version"]), "No pudimos moderar la reseña."));
}

export async function replyReview(_state: StepResult, form: FormData): Promise<StepResult> {
  return done(await sendStep(`/reviews/${code(form)}/reply`, "PUT", formValues(form, ["text", "lock_version"]), "No pudimos guardar la respuesta."));
}

export async function reviewRequestAction(_state: StepResult, form: FormData): Promise<StepResult> {
  return done(await sendStep(`/review-requests/${code(form)}/${form.get("action") === "cancelar" ? "cancel" : "send"}`, "POST", {}, "No pudimos actualizar la solicitud."));
}

export async function saveReviewSettings(values: Record<string, unknown>, lockVersion: number): Promise<StepResult> {
  return done(await sendStep("/settings/own-reviews", "PATCH", { ...values, lock_version: lockVersion }, "No pudimos guardar los ajustes."));
}

export async function scheduleInvitations(): Promise<StepResult & { created?: number }> {
  const result = await apiFetch<{ created: unknown[]; skipped: unknown[] }>("/review-requests/schedule-pending", { method: "POST", body: {} });
  if (!result.ok || !result.data) return { done: false, message: result.error?.message ?? "No pudimos programar las invitaciones." };
  revalidatePath("/canales/resenas-propias");
  const created = result.data.created.length;
  const skipped = result.data.skipped.length;
  return { done: true, created, message: created === 0 ? "No hay viajes terminados sin invitación." : `Programamos ${created} ${created === 1 ? "invitación" : "invitaciones"}${skipped > 0 ? `; ${skipped} sin dato de contacto` : ""}.` };
}

export async function exportReviewFeed(): Promise<StepResult> {
  const result = await apiFetch<{ count: number; widget: boolean }>("/reviews/export-feed", { method: "POST", body: {} });
  if (!result.ok || !result.data) return { done: false, message: result.error?.message ?? "No pudimos exportar el feed." };
  revalidatePath("/canales/resenas-propias");
  return { done: true, message: result.data.widget ? `Feed actualizado con ${result.data.count} reseñas publicadas.` : "El widget está apagado: el feed quedó vacío." };
}
