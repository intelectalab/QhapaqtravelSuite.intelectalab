"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const FIELDS = ["name", "type", "ruc", "city", "stars", "contact_name", "phone", "email", "contract_start", "contract_end", "currency", "payment_terms", "rating", "rating_note"];

const ref = (form: FormData) => encodeURIComponent(String(form.get("ref") ?? ""));

async function run(path: string, method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, failure: string): Promise<StepResult> {
  const result = await sendStep(path, method, body, failure);
  if (result.done) {
    revalidatePath("/catalogo/proveedores", "layout");
    revalidatePath("/catalogo/servicios", "layout");
  }
  return result;
}

export async function createProvider(_state: StepResult & { ref?: string }, form: FormData): Promise<StepResult & { ref?: string }> {
  const result = await apiFetch<{ ref: string }>("/catalog/providers", { method: "POST", body: formValues(form, FIELDS) });
  if (!result.ok || !result.data) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? "No pudimos crear el proveedor.", done: false };
  }
  revalidatePath("/catalogo/proveedores", "layout");
  return { message: null, done: true, ref: result.data.ref };
}

export async function updateProvider(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`/catalog/providers/${ref(form)}`, "PATCH", formValues(form, FIELDS), "No pudimos guardar el proveedor.");
}

export async function toggleProvider(_state: StepResult, form: FormData): Promise<StepResult> {
  const action = form.get("action") === "activate" ? "activate" : "deactivate";
  return run(`/catalog/providers/${ref(form)}/${action}`, "POST", formValues(form, ["reason"]), "No pudimos cambiar el estado del proveedor.");
}

export async function addProviderContact(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`/catalog/providers/${ref(form)}/contacts`, "POST", formValues(form, ["name", "role", "phone", "email"]), "No pudimos agregar el contacto.");
}

export async function removeProviderContact(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`/catalog/providers/${ref(form)}/contacts/${encodeURIComponent(String(form.get("contact") ?? ""))}`, "DELETE", {}, "No pudimos quitar el contacto.");
}

export async function renewProviderContract(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`/catalog/providers/${ref(form)}/renew-contract`, "POST", formValues(form, ["contract_end", "payment_terms"]), "No pudimos renovar el contrato.");
}

export async function rateProvider(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`/catalog/providers/${ref(form)}/rating`, "POST", formValues(form, ["rating", "note"]), "No pudimos guardar la calificación.");
}
