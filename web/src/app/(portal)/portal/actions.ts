"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";
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
  const result = await sendStep(`/portal/client/receivables/${encodeURIComponent(code)}/payment-reports`, "POST", formValues(form, ["amount", "method", "reference", "paid_on", "note"]), "No pudimos registrar tu pago.");
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

const REVIEW_PHOTOS = 4;

const REVIEW_PHOTO_BYTES = 5 * 1024 * 1024;

export async function sendReview(_state: StepResult, form: FormData): Promise<StepResult> {
  const photos = form.getAll("photos").filter((file): file is File => file instanceof File && file.size > 0);
  if (photos.length > REVIEW_PHOTOS) return { message: `Puedes adjuntar hasta ${REVIEW_PHOTOS} fotos.`, done: false };
  const heavy = photos.find((file) => file.size > REVIEW_PHOTO_BYTES);
  if (heavy) return { message: `${heavy.name} pesa más de 5 MB.`, done: false };

  const payload = new FormData();
  for (const [key, value] of Object.entries(formValues(form, ["trip", "product", "stars", "title", "body", "lang", "country"]))) {
    if (value !== null && value !== undefined && value !== "") payload.set(key, String(value));
  }
  for (const [key, value] of form.entries()) {
    if (key.startsWith("sub_") && typeof value === "string" && value !== "") payload.set(`subratings[${key.slice(4)}]`, value);
  }
  payload.set("consent_publish", form.get("consent_publish") === "on" ? "1" : "0");
  photos.forEach((file, index) => payload.append(`photos[${index}]`, file, file.name));

  const result = await apiFetch("/portal/passenger/reviews", { method: "POST", form: payload });
  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? "No pudimos enviar tu reseña.", done: false };
  }
  refresh("/portal/califica");
  return { message: null, done: true };
}

export async function sendMessage(_state: StepResult, form: FormData): Promise<StepResult> {
  const result = await sendStep("/portal/client/tickets", "POST", formValues(form, ["body", "subject", "conversation", "trip", "topic", "priority"]), "No pudimos enviar tu mensaje.");
  if (result.done) refresh("/portal/mensajes");
  return result;
}

export async function ackAlert(code: string): Promise<StepResult> {
  const result = await sendStep(`/portal/passenger/alerts/${encodeURIComponent(code)}/ack`, "POST", {}, "No pudimos confirmar la lectura.");
  if (result.done) refresh("/portal/avisos");
  return result;
}

export async function readNotice(code: string | null): Promise<StepResult> {
  const path = code ? `/portal/passenger/messages/${encodeURIComponent(code)}/read` : "/portal/passenger/messages/read-all";
  const result = await sendStep(path, "POST", {}, "No pudimos marcar el mensaje como leído.");
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

export async function payOnline(code: string, _state: StepResult, form: FormData): Promise<StepResult> {
  const result = await apiFetch<{ result: string; message: string }>(`/portal/client/receivables/${encodeURIComponent(code)}/payments`, { method: "POST", body: formValues(form, ["method", "card_token", "card_holder", "operation_ref"]) });
  refresh("/portal/pagos");
  if (!result.ok || !result.data) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? "No pudimos procesar el pago.", done: false };
  }
  return result.data.result === "rechazado" ? { message: result.data.message, done: false } : { message: result.data.message, done: true };
}

export async function buyInTrip(code: string, kind: "tour" | "transport", itemId: string): Promise<{ message: string | null; done: boolean; url: string | null }> {
  const result = await apiFetch<{ offer: { payment_link: { url: string | null } | null } }>(`/portal/client/reservations/${encodeURIComponent(code)}/in-trip`, { method: "POST", body: { kind, item_id: itemId } });
  refresh(`/portal/viajes/${code}`);
  if (!result.ok || !result.data) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? "No pudimos generar el link de pago.", done: false, url: null };
  }
  return { message: null, done: true, url: result.data.offer.payment_link?.url ?? null };
}
