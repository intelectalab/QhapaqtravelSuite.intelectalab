"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const BASE = "/crm/corporate-accounts";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function refresh(result: StepResult): StepResult {
  if (result.done) revalidatePath("/crm/cuentas-corporativas", "layout");
  return result;
}

function conditions(form: FormData): Record<string, unknown> {
  return {
    ...formValues(form, ["currency", "credit_days", "approval_threshold", "approval_ttl_hours", "statement_day", "notes", "default_cost_center_id"]),
    require_approval: form.get("require_approval") === "on",
    statement_auto: form.get("statement_auto") === "on",
    statement_recipients: text(form, "statement_recipients").split(/[,;\s]+/).filter(Boolean),
  };
}

export async function createAccount(_state: StepResult, form: FormData): Promise<StepResult> {
  return refresh(await sendStep(BASE, "POST", { client_id: text(form, "client_id"), ...conditions(form) }, "No pudimos dar de alta la cuenta corporativa."));
}

export async function updateAccount(id: string, _state: StepResult, form: FormData): Promise<StepResult> {
  return refresh(await sendStep(`${BASE}/${id}`, "PATCH", { ...conditions(form), lock_version: Number(text(form, "lock_version")) }, "No pudimos guardar las condiciones."));
}

export async function suspendAccount(id: string, _state: StepResult, form: FormData): Promise<StepResult> {
  return refresh(await sendStep(`${BASE}/${id}/suspend`, "POST", { active: text(form, "active") === "1", reason: text(form, "reason") || null, lock_version: Number(text(form, "lock_version")) }, "No pudimos cambiar el estado de la cuenta."));
}

export async function saveAccountUser(id: string, _state: StepResult, form: FormData): Promise<StepResult> {
  const userId = text(form, "id");
  if (userId) {
    const body = { ...formValues(form, ["full_name", "portal_role", "cost_center_id", "traveler_id"]), ...(text(form, "status") ? { status: text(form, "status") } : {}) };
    return refresh(await sendStep(`${BASE}/${id}/portal-users/${encodeURIComponent(userId)}`, "PATCH", body, "No pudimos guardar el usuario."));
  }
  return refresh(await sendStep(`${BASE}/${id}/portal-users`, "POST", formValues(form, ["full_name", "email", "portal_role", "cost_center_id", "traveler_id"]), "No pudimos enviar la invitación."));
}

export async function resendAccountInvite(id: string, _state: StepResult, form: FormData): Promise<StepResult> {
  return refresh(await sendStep(`${BASE}/${id}/portal-users/${encodeURIComponent(text(form, "id"))}/resend-invite`, "POST", {}, "No pudimos reenviar la invitación."));
}

export async function saveAccountCenter(id: string, _state: StepResult, form: FormData): Promise<StepResult> {
  const code = text(form, "original_code");
  const body = { ...formValues(form, ["name", "budget_amount", "budget_period"]), ...(code ? { active: form.get("active") === "on" } : { code: text(form, "code") }) };
  return refresh(await sendStep(code ? `${BASE}/${id}/cost-centers/${encodeURIComponent(code)}` : `${BASE}/${id}/cost-centers`, code ? "PATCH" : "POST", body, "No pudimos guardar el centro de costo."));
}

export async function saveAccountTraveler(id: string, _state: StepResult, form: FormData): Promise<StepResult> {
  const travelerId = text(form, "traveler_id");
  const body = { ...formValues(form, ["full_name", "email", "doc_type", "doc_number", "employee_code", "cost_center_id"]), ...(travelerId ? { active: form.get("active") === "on" } : {}) };
  return refresh(await sendStep(travelerId ? `${BASE}/${id}/travelers/${encodeURIComponent(travelerId)}` : `${BASE}/${id}/travelers`, travelerId ? "PATCH" : "POST", body, "No pudimos guardar el viajero."));
}

export async function importAccountTravelers(id: string, _state: StepResult, form: FormData): Promise<StepResult> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { message: "Elige un archivo CSV o Excel.", done: false };
  const upload = new FormData();
  upload.append("file", file);
  const result = await apiFetch<{ created: number; updated: number; skipped: { row: number; message: string }[] }>(`${BASE}/${id}/travelers/import`, { method: "POST", form: upload });
  if (!result.ok) return { message: result.error?.message ?? "No pudimos importar el archivo.", done: false };
  const skipped = result.data?.skipped ?? [];
  revalidatePath("/crm/cuentas-corporativas", "layout");
  return skipped.length > 0 ? { message: `${result.data?.created ?? 0} nuevos y ${result.data?.updated ?? 0} actualizados. Fila ${skipped[0].row}: ${skipped[0].message}`, done: false } : { message: null, done: true };
}
