"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const FIELDS = ["legal_name", "ruc", "contact_name", "booking_email", "client", "price_list_id", "commission_pct", "currency", "credit_limit", "valid_from", "valid_to"];

export async function saveAgency(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = form.get("code");
  const body = formValues(form, FIELDS);
  const result = typeof code === "string" && code !== ""
    ? await sendStep(`/channels/b2b/agencies/${encodeURIComponent(code)}`, "PATCH", body, "No pudimos guardar la agencia.")
    : await sendStep("/channels/b2b/agencies", "POST", body, "No pudimos registrar la agencia.");
  if (result.done) revalidatePath("/canales/b2b");
  return result;
}

export async function changeAgencyStatus(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = String(form.get("code") ?? "");
  const result = await sendStep(`/channels/b2b/agencies/${encodeURIComponent(code)}/status`, "POST", formValues(form, ["status", "reason"]), "No pudimos cambiar el estado de la agencia.");
  if (result.done) revalidatePath("/canales/b2b");
  return result;
}
