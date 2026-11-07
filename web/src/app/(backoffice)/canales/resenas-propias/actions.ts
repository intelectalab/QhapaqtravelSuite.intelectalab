"use server";

import { revalidatePath } from "next/cache";
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
