"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const FIELDS = ["provider_id", "name", "type", "unit", "cost", "currency", "capacity", "valid_from", "valid_to"];

const ref = (form: FormData) => encodeURIComponent(String(form.get("ref") ?? ""));

async function run(path: string, method: "POST" | "PATCH", body: Record<string, unknown>, failure: string): Promise<StepResult> {
  const result = await sendStep(path, method, body, failure);
  if (result.done) {
    revalidatePath("/catalogo/servicios", "layout");
    revalidatePath("/catalogo/proveedores", "layout");
  }
  return result;
}

export async function createService(_state: StepResult, form: FormData): Promise<StepResult> {
  return run("/catalog/services", "POST", formValues(form, FIELDS), "No pudimos crear el servicio.");
}

export async function updateService(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`/catalog/services/${ref(form)}`, "PATCH", formValues(form, FIELDS), "No pudimos guardar el servicio.");
}

export async function toggleService(_state: StepResult, form: FormData): Promise<StepResult> {
  const action = form.get("action") === "activate" ? "activate" : "deactivate";
  return run(`/catalog/services/${ref(form)}/${action}`, "POST", formValues(form, ["reason"]), "No pudimos cambiar el estado del servicio.");
}
