"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const SHEET = ["type", "consumer_name", "consumer_doc_type", "consumer_doc_number", "consumer_email", "consumer_phone", "consumer_address", "good_kind", "good_description", "good_amount", "good_currency", "detail", "request", "client", "reservation"];

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function refresh(result: StepResult): StepResult {
  if (result.done) revalidatePath("/crm/reclamaciones");
  return result;
}

export async function saveClaim(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = text(form, "code");
  if (code) return refresh(await sendStep(`/crm/claims/${encodeURIComponent(code)}`, "PATCH", formValues(form, SHEET), "No pudimos guardar la hoja."));
  return refresh(await sendStep("/crm/claims", "POST", formValues(form, ["sede_id", ...SHEET]), "No pudimos registrar la hoja."));
}

export async function claimStep(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = encodeURIComponent(text(form, "code"));
  const step = text(form, "step");
  const failure = "No pudimos actualizar la hoja.";
  if (step === "evaluate") return refresh(await sendStep(`/crm/claims/${code}/evaluate`, "POST", {}, failure));
  if (step === "respond") return refresh(await sendStep(`/crm/claims/${code}/respond`, "POST", formValues(form, ["decision", "text", "actions"]), failure));
  if (step === "close") return refresh(await sendStep(`/crm/claims/${code}/close`, "POST", formValues(form, ["note"]), failure));
  return { message: null, done: true };
}
