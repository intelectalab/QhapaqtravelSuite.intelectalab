"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

export async function registerFxRate(_state: StepResult, form: FormData): Promise<StepResult> {
  const result = await sendStep("/finance/fx-rates", "POST", formValues(form, ["currency", "rate", "buy", "sell", "rate_date", "source"]), "No pudimos registrar el tipo de cambio.");
  if (result.done) revalidatePath("/admin/monedas");
  return result;
}
