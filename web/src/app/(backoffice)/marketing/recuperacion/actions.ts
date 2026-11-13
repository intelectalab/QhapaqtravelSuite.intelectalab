"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function refresh(result: StepResult): StepResult {
  if (result.done) revalidatePath("/marketing/recuperacion");
  return result;
}

export async function saveRecoveryFlow(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = text(form, "code");
  const body = {
    ...formValues(form, ["name", "trigger_kind", "channel", "template_ref"]),
    delay_minutes: Number(text(form, "delay_value") || "0") * Number(text(form, "delay_unit") || "60"),
    max_attempts: Number(text(form, "max_attempts") || "2"),
    include_payment_link: text(form, "include_payment_link") === "1",
    active: text(form, "active") === "1",
  };
  return refresh(await sendStep(code ? `/marketing/recovery-flows/${encodeURIComponent(code)}` : "/marketing/recovery-flows", code ? "PATCH" : "POST", body, "No pudimos guardar el flujo."));
}

export async function toggleRecoveryFlow(_state: StepResult, form: FormData): Promise<StepResult> {
  return refresh(await sendStep(`/marketing/recovery-flows/${encodeURIComponent(text(form, "code"))}`, "PATCH", { active: text(form, "active") === "1" }, "No pudimos cambiar el estado del flujo."));
}
