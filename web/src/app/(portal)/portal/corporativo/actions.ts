"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const BASE = "/portal/client/corporate";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function refresh(result: StepResult): StepResult {
  if (result.done) revalidatePath("/portal", "layout");
  return result;
}

function recipients(form: FormData): string[] {
  return text(form, "statement_recipients")
    .split(/[,;\s]+/)
    .map((email) => email.trim())
    .filter(Boolean);
}

export async function saveStatementSettings(_state: StepResult, form: FormData): Promise<StepResult> {
  const body = { statement_auto: form.get("statement_auto") === "on", statement_day: Number(text(form, "statement_day") || 1), statement_recipients: recipients(form), lock_version: Number(text(form, "lock_version")) };
  return refresh(await sendStep(`${BASE}/statement-settings`, "PATCH", body, "No pudimos guardar la configuración del envío."));
}

export async function decideApproval(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = encodeURIComponent(text(form, "code"));
  const decision = text(form, "decision") === "reject" ? "reject" : "approve";
  const body = decision === "reject" ? formValues(form, ["reason", "lock_version"]) : formValues(form, ["note", "lock_version"]);
  return refresh(await sendStep(`${BASE}/approvals/${code}/${decision}`, "POST", body, "No pudimos registrar la decisión."));
}

export async function savePortalUser(_state: StepResult, form: FormData): Promise<StepResult> {
  const id = text(form, "id");
  if (id) {
    const body = { ...formValues(form, ["full_name", "portal_role", "cost_center_id", "traveler_id"]), ...(text(form, "status") ? { status: text(form, "status") } : {}) };
    return refresh(await sendStep(`${BASE}/users/${encodeURIComponent(id)}`, "PATCH", body, "No pudimos guardar el usuario."));
  }
  return refresh(await sendStep(`${BASE}/users`, "POST", formValues(form, ["full_name", "email", "portal_role", "cost_center_id", "traveler_id"]), "No pudimos enviar la invitación."));
}

export async function saveCostCenter(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = text(form, "original_code");
  const body = { ...formValues(form, ["name", "budget_amount", "budget_period"]), ...(code ? { active: form.get("active") === "on" } : { code: text(form, "code") }) };
  return refresh(await sendStep(code ? `${BASE}/cost-centers/${encodeURIComponent(code)}` : `${BASE}/cost-centers`, code ? "PATCH" : "POST", body, "No pudimos guardar el centro de costo."));
}

export async function saveTraveler(_state: StepResult, form: FormData): Promise<StepResult> {
  return refresh(await sendStep(`${BASE}/travelers`, "POST", formValues(form, ["full_name", "email", "doc_type", "doc_number", "employee_code", "cost_center_id"]), "No pudimos registrar al viajero."));
}

export async function requestExport(_state: StepResult, form: FormData): Promise<StepResult> {
  const filters = formValues(form, ["period", "cost_center", "kind"]);
  return refresh(await sendStep(`${BASE}/exports`, "POST", { report_type: text(form, "report_type"), format: text(form, "format"), filters }, "No pudimos pedir la exportación."));
}
