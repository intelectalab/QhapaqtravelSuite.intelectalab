"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const id = (form: FormData) => encodeURIComponent(String(form.get("id") ?? ""));

export async function replyExternalReview(_state: StepResult, form: FormData): Promise<StepResult> {
  const result = await sendStep(`/channels/external-reviews/${id(form)}/reply`, "PUT", formValues(form, ["text"]), "No pudimos guardar la respuesta.");
  if (result.done) revalidatePath("/canales/resenas");
  return result;
}

export async function markExternalPublished(_state: StepResult, form: FormData): Promise<StepResult> {
  const result = await sendStep(`/channels/external-reviews/${id(form)}/mark-published`, "POST", {}, "No pudimos marcar la respuesta como publicada.");
  if (result.done) revalidatePath("/canales/resenas");
  return result;
}
