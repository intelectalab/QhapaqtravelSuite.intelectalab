"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const id = (form: FormData) => encodeURIComponent(String(form.get("id") ?? ""));
const provider = (form: FormData) => encodeURIComponent(String(form.get("provider") ?? ""));

const done = (result: StepResult) => {
  if (result.done) revalidatePath("/canales/resenas", "layout");
  return result;
};

export async function replyExternalReview(_state: StepResult, form: FormData): Promise<StepResult> {
  return done(await sendStep(`/channels/external-reviews/${id(form)}/reply`, "POST", formValues(form, ["text"]), "No pudimos guardar la respuesta."));
}

export async function markExternalPublished(_state: StepResult, form: FormData): Promise<StepResult> {
  return done(await sendStep(`/channels/external-reviews/${id(form)}/mark-published`, "POST", {}, "No pudimos marcar la respuesta como publicada."));
}

export async function escalateExternalReview(_state: StepResult, form: FormData): Promise<StepResult> {
  return done(await sendStep(`/channels/external-reviews/${id(form)}/escalate`, "POST", formValues(form, ["note"]), "No pudimos derivar la reseña a postventa."));
}

export async function saveReviewWidget(_state: StepResult, form: FormData): Promise<StepResult> {
  const body = { ...formValues(form, ["min_rating", "count", "layout"]), sources: form.getAll("sources").map(String) };
  return done(await sendStep("/channels/external-reviews/widget", "PUT", body, "No pudimos guardar el widget de reseñas."));
}

export async function connectReviewSource(_state: StepResult, form: FormData): Promise<StepResult> {
  const body = { ...formValues(form, ["provider", "account", "credential"]), scopes: form.getAll("scopes").map(String), contract_ack: form.get("contract_ack") === "1" };
  return done(await sendStep("/integrations/review-sources", "POST", body, "No pudimos conectar la plataforma."));
}

export async function syncReviewSource(_state: StepResult, form: FormData): Promise<StepResult> {
  return done(await sendStep(`/integrations/review-sources/${provider(form)}/sync`, "POST", {}, "No pudimos sincronizar la plataforma."));
}

export async function disconnectReviewSource(_state: StepResult, form: FormData): Promise<StepResult> {
  return done(await sendStep(`/integrations/review-sources/${provider(form)}`, "DELETE", {}, "No pudimos desconectar la plataforma."));
}

export async function inviteReservationReview(_state: StepResult, form: FormData): Promise<StepResult> {
  return done(await sendStep(`/reservations/${encodeURIComponent(String(form.get("reservation") ?? ""))}/review-invitations`, "POST", formValues(form, ["channel"]), "No pudimos enviar la invitación."));
}
