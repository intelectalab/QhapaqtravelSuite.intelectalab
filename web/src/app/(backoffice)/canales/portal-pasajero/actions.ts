"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

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
