"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const done = (result: StepResult) => {
  if (result.done) revalidatePath("/canales/resenas-propias");
  return result;
};

const code = (form: FormData) => encodeURIComponent(String(form.get("code") ?? ""));

export async function moderateReview(_state: StepResult, form: FormData): Promise<StepResult> {
  return done(await sendStep(`/channels/own-reviews/${code(form)}/moderate`, "POST", formValues(form, ["action", "reason"]), "No pudimos moderar la reseña."));
}

export async function replyReview(_state: StepResult, form: FormData): Promise<StepResult> {
  return done(await sendStep(`/channels/own-reviews/${code(form)}/reply`, "PUT", formValues(form, ["text"]), "No pudimos guardar la respuesta."));
}

export async function reviewRequestAction(_state: StepResult, form: FormData): Promise<StepResult> {
  return done(await sendStep(`/channels/review-requests/${code(form)}`, "POST", formValues(form, ["action"]), "No pudimos actualizar la solicitud."));
}
