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

export async function sendMessage(_state: StepResult, form: FormData): Promise<StepResult> {
  const result = await sendStep("/portal/client/tickets", "POST", formValues(form, ["body", "subject", "conversation", "trip", "topic"]), "No pudimos enviar tu mensaje.");
  if (result.done) refresh("/portal/mensajes");
  return result;
}
