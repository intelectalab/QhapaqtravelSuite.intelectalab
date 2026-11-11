"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch } from "@/lib/server/api";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const CONTRACT_FIELDS = ["name", "contract_ref", "valid_from", "valid_to", "base_qty", "release_days", "net_rate", "currency", "penalty_pct", "notes"];

const key = (form: FormData, field: string) => encodeURIComponent(String(form.get(field) ?? ""));

const contract = (form: FormData) => `/catalog/allotments/${key(form, "code")}`;

async function run(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body: Record<string, unknown>, failure: string): Promise<StepResult> {
  const result = await sendStep(path, method, body, failure);
  if (result.done) revalidatePath("/catalogo/cupos", "layout");
  return result;
}

const version = (form: FormData) => {
  const value = form.get("lock_version");
  return typeof value === "string" && value !== "" ? { lock_version: Number(value) } : {};
};

export async function createContract(_state: StepResult, form: FormData): Promise<StepResult> {
  if (!form.get("provider_id")) return { message: "Elige el proveedor.", done: false };
  if (!form.get("service_id")) return { message: "Elige el servicio contratado.", done: false };
  const result = await apiFetch<{ code: string }>("/catalog/allotments", { method: "POST", body: formValues(form, ["provider_id", "service_id", ...CONTRACT_FIELDS]) });
  if (!result.ok || !result.data) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? "No pudimos registrar el contrato.", done: false };
  }
  revalidatePath("/catalogo/cupos", "layout");
  redirect(`/catalogo/cupos/${encodeURIComponent(result.data.code)}`);
}

export async function updateContract(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(contract(form), "PATCH", { ...formValues(form, CONTRACT_FIELDS), ...version(form) }, "No pudimos guardar el contrato.");
}

export async function releaseContract(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`${contract(form)}/release`, "POST", { ...formValues(form, ["reason"]), ...version(form) }, "No pudimos liberar el contrato.");
}

export async function deleteContract(_state: StepResult, form: FormData): Promise<StepResult> {
  const result = await sendStep(contract(form), "DELETE", formValues(form, ["reason"]), "No pudimos eliminar el contrato.");
  if (!result.done) return result;
  revalidatePath("/catalogo/cupos", "layout");
  redirect("/catalogo/cupos/contratos");
}

export async function releaseDay(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`${contract(form)}/days/${key(form, "date")}/release`, "POST", { ...formValues(form, ["qty"]), ...version(form) }, "No pudimos liberar las unidades.");
}

export async function retainDay(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`${contract(form)}/days/${key(form, "date")}/retention`, "PUT", { ...formValues(form, ["reason"]), ...version(form) }, "No pudimos retener la fecha.");
}

export async function unretainDay(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`${contract(form)}/days/${key(form, "date")}/retention`, "DELETE", version(form), "No pudimos quitar la retención.");
}

export async function requestExpansion(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`${contract(form)}/requests`, "POST", formValues(form, ["date_from", "date_to", "extra_qty", "note"]), "No pudimos registrar la solicitud.");
}

export async function respondExpansion(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`${contract(form)}/requests/${key(form, "request")}/respond`, "POST", { accepted: form.get("accepted") === "1", ...formValues(form, ["response"]) }, "No pudimos registrar la respuesta.");
}

export async function runReleaseJob(): Promise<StepResult> {
  return run("/catalog/allotments/jobs/release", "POST", {}, "No pudimos ejecutar el release.");
}
