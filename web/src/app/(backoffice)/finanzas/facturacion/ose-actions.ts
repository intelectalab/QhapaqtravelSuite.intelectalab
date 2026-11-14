"use server";

import { revalidatePath } from "next/cache";
import { sendStep, type StepResult } from "@/lib/server/resource";

export async function selectOse(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = String(form.get("code") ?? "");
  const result = await sendStep("/finance/ose", "PUT", { code: code === "" ? null : code }, "No pudimos guardar el OSE elegido.");
  if (result.done) revalidatePath("/finanzas/facturacion");
  return result;
}
