"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

export async function registerFxRate(_state: StepResult, form: FormData): Promise<StepResult> {
  const result = await sendStep("/finance/fx-rates", "POST", formValues(form, ["currency", "rate", "buy", "sell", "rate_date", "source"]), "No pudimos registrar el tipo de cambio.");
  if (result.done) revalidatePath("/admin/monedas");
  return result;
}

function refresh(result: StepResult): StepResult {
  if (result.done) revalidatePath("/admin/monedas");
  return result;
}

export async function updateCurrency(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = encodeURIComponent(String(form.get("code") ?? ""));
  const field = String(form.get("field") ?? "");
  const body = field === "is_charge" ? { is_charge: form.get("value") === "1" } : { active: form.get("value") === "1" };
  return refresh(await sendStep(`/finance/currencies/${code}`, "PATCH", body, "No pudimos actualizar la moneda."));
}

export async function saveFxSettings(_state: StepResult, form: FormData): Promise<StepResult> {
  return refresh(await sendStep("/finance/fx-settings", "PATCH", formValues(form, ["margin_pct", "alert_pct"]), "No pudimos guardar el margen."));
}
