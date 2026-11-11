"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const GOALS = ["goal_sales", "goal_bookings", "goal_margin", "goal_conversion", "bonus_amount"];

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function refresh(result: StepResult): StepResult {
  if (result.done) revalidatePath("/crm/metas", "layout");
  return result;
}

export async function saveTarget(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = text(form, "code");
  if (code) return refresh(await sendStep(`/crm/sales-targets/${encodeURIComponent(code)}`, "PATCH", formValues(form, [...GOALS, "reason"]), "No pudimos ajustar la meta."));
  const body = { ...formValues(form, ["scope_type", "scope_id", "period", ...GOALS]), activate: form.get("activate") === "on" };
  return refresh(await sendStep("/crm/sales-targets", "POST", body, "No pudimos crear la meta."));
}

export async function targetStep(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = encodeURIComponent(text(form, "code"));
  const step = text(form, "step");
  if (!["activate", "void", "close"].includes(step)) return { message: "Acción no disponible.", done: false };
  return refresh(await sendStep(`/crm/sales-targets/${code}/${step}`, "POST", formValues(form, ["reason", "lock_version"]), "No pudimos actualizar la meta."));
}
