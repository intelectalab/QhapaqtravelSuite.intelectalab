"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PASSENGER_PREVIEW_BACK } from "@/lib/agency-preview";
import { apiFetch } from "@/lib/server/api";
import { startPreviewSession } from "@/lib/server/preview-session";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

export async function previewPassengerPortal(_state: StepResult, form: FormData): Promise<StepResult> {
  const result = await apiFetch<{ token: string; expires_at: string }>("/channels/passenger-portal/preview", { method: "POST", body: formValues(form, ["reservation"]) });
  if (!result.ok || !result.data) return { message: result.error?.message ?? "No pudimos abrir la vista previa del portal.", done: false };
  if (!(await startPreviewSession(result.data.token, result.data.expires_at, PASSENGER_PREVIEW_BACK))) return { message: "Tu sesión venció. Vuelve a ingresar.", done: false };
  redirect("/portal");
}

const code = (form: FormData) => encodeURIComponent(String(form.get("code") ?? ""));

export async function replyFeedback(_state: StepResult, form: FormData): Promise<StepResult> {
  const result = await sendStep(`/channels/passenger-portal/feedback/${code(form)}/reply`, "PUT", formValues(form, ["text"]), "No pudimos enviar la respuesta.");
  if (result.done) revalidatePath("/canales/portal-pasajero");
  return result;
}

export async function markFeedback(_state: StepResult, form: FormData): Promise<StepResult> {
  const result = await sendStep(`/channels/passenger-portal/feedback/${code(form)}/status`, "POST", formValues(form, ["status"]), "No pudimos actualizar el comentario.");
  if (result.done) revalidatePath("/canales/portal-pasajero");
  return result;
}
