"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

function refresh(...paths: string[]) {
  for (const path of ["/portal", ...paths]) revalidatePath(path);
}

export async function approveQuote(code: string, _state: StepResult, form: FormData): Promise<StepResult> {
  const result = await sendStep(`/portal/client/quotes/${encodeURIComponent(code)}/approve`, "POST", { ...formValues(form, ["name", "comment", "lock_version"]), accept: form.get("accept") === "on" }, "No pudimos registrar tu aprobación.");
  if (result.done) refresh("/portal/propuestas", `/portal/propuestas/${code}`);
  return result;
}

export async function rejectQuote(code: string, _state: StepResult, form: FormData): Promise<StepResult> {
  const result = await sendStep(`/portal/client/quotes/${encodeURIComponent(code)}/reject`, "POST", formValues(form, ["reason", "comment", "lock_version"]), "No pudimos registrar tu respuesta.");
  if (result.done) refresh("/portal/propuestas", `/portal/propuestas/${code}`);
  return result;
}

export async function reportPayment(code: string, _state: StepResult, form: FormData): Promise<StepResult> {
  const result = await sendStep(`/portal/client/receivables/${encodeURIComponent(code)}/payments`, "POST", formValues(form, ["amount", "method", "reference", "paid_on", "note"]), "No pudimos registrar tu pago.");
  if (result.done) refresh("/portal/pagos");
  return result;
}

export async function updateProfile(_state: StepResult, form: FormData): Promise<StepResult> {
  const result = await sendStep("/portal/client/profile", "PATCH", formValues(form, ["email", "phone", "city", "country", "locale"]), "No pudimos guardar tus datos.");
  if (result.done) refresh("/portal/datos");
  return result;
}

export async function setConsent(channel: string, granted: boolean): Promise<StepResult> {
  const result = await sendStep(`/portal/client/profile/consents/${encodeURIComponent(channel)}`, "PUT", { granted }, "No pudimos guardar tu preferencia.");
  if (result.done) refresh("/portal/datos");
  return result;
}

export async function requestDataRights(_state: StepResult, form: FormData): Promise<StepResult> {
  const result = await sendStep("/public/me/arco-requests", "POST", formValues(form, ["type", "detail"]), "No pudimos enviar tu solicitud.");
  if (result.done) refresh("/portal/datos");
  return result;
}

export async function sendFeedback(_state: StepResult, form: FormData): Promise<StepResult> {
  const result = await sendStep("/portal/passenger/feedback", "POST", formValues(form, ["trip", "type", "rating", "service", "text"]), "No pudimos enviar tu comentario.");
  if (result.done) refresh("/portal/comentarios", "/portal/mensajes");
  return result;
}

export async function sendReview(_state: StepResult, form: FormData): Promise<StepResult> {
  const subratings = Object.fromEntries([...form.entries()].filter(([key, value]) => key.startsWith("sub_") && typeof value === "string" && value !== "").map(([key, value]) => [key.slice(4), Number(value)]));
  const result = await sendStep("/portal/passenger/reviews", "POST", { ...formValues(form, ["trip", "product", "stars", "title", "body", "lang", "country"]), subratings, consent_publish: form.get("consent_publish") === "on" }, "No pudimos enviar tu reseña.");
  if (result.done) refresh("/portal/califica");
  return result;
}

export async function sendMessage(_state: StepResult, form: FormData): Promise<StepResult> {
  const result = await sendStep("/portal/client/tickets", "POST", formValues(form, ["body", "subject", "conversation", "trip", "topic"]), "No pudimos enviar tu mensaje.");
  if (result.done) refresh("/portal/mensajes");
  return result;
}

export async function ackAlert(code: string): Promise<StepResult> {
  const result = await sendStep(`/portal/passenger/alerts/${encodeURIComponent(code)}/ack`, "POST", {}, "No pudimos confirmar la lectura.");
  if (result.done) refresh("/portal/avisos");
  return result;
}

export async function saveCompanions(trip: string, version: number, payload: Record<string, unknown>): Promise<StepResult> {
  const result = await sendStep("/portal/passenger/companions", "PUT", { trip, lock_version: version, ...payload }, "No pudimos guardar los datos de los viajeros.");
  if (result.done) refresh("/portal/viajeros", `/portal/viajes/${trip}`);
  return result;
}

export async function requestQuoteChanges(code: string, _state: StepResult, form: FormData): Promise<StepResult> {
  const result = await sendStep(`/portal/client/quotes/${encodeURIComponent(code)}/update-request`, "POST", formValues(form, ["message"]), "No pudimos enviar tu pedido.");
  if (result.done) refresh("/portal/propuestas", `/portal/propuestas/${code}`, "/portal/mensajes");
  return result;
}
