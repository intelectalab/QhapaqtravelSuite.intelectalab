"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const BASE = "/finance/corporate-statements";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function refresh(result: StepResult): StepResult {
  if (result.done) revalidatePath("/finanzas/estados-cuenta-corporativos");
  return result;
}

export async function generateStatement(_state: StepResult, form: FormData): Promise<StepResult> {
  return refresh(await sendStep(BASE, "POST", formValues(form, ["account_id", "month"]), "No pudimos generar el estado de cuenta."));
}

export async function sendStatement(_state: StepResult, form: FormData): Promise<StepResult> {
  const recipients = text(form, "recipients").split(/[,;\s]+/).filter(Boolean);
  return refresh(await sendStep(`${BASE}/${encodeURIComponent(text(form, "code"))}/send`, "POST", recipients.length ? { recipients } : {}, "No pudimos enviar el estado de cuenta."));
}

export async function voidStatement(_state: StepResult, form: FormData): Promise<StepResult> {
  return refresh(await sendStep(`${BASE}/${encodeURIComponent(text(form, "code"))}/void`, "POST", formValues(form, ["reason"]), "No pudimos anular el estado de cuenta."));
}
