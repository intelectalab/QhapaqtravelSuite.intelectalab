"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const id = (form: FormData) => encodeURIComponent(String(form.get("id") ?? ""));

const done = (result: StepResult) => {
  if (result.done) revalidatePath("/canales/resenas", "layout");
  return result;
};

export async function replyExternalReview(_state: StepResult, form: FormData): Promise<StepResult> {
  return done(await sendStep(`/channels/external-reviews/${id(form)}/reply`, "PUT", formValues(form, ["text"]), "No pudimos guardar la respuesta."));
}

export async function markExternalPublished(_state: StepResult, form: FormData): Promise<StepResult> {
  return done(await sendStep(`/channels/external-reviews/${id(form)}/mark-published`, "POST", {}, "No pudimos marcar la respuesta como publicada."));
}

export async function saveReviewWidget(_state: StepResult, form: FormData): Promise<StepResult> {
  const body = { ...formValues(form, ["min_rating", "count", "layout"]), sources: form.getAll("sources").map(String) };
  return done(await sendStep("/channels/external-reviews/widget", "PUT", body, "No pudimos guardar el widget de reseñas."));
}
