"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const RANGE_FIELDS = ["date_from", "date_to", "status", "capacity_per_day", "note"];

const key = (form: FormData, field: string) => encodeURIComponent(String(form.get(field) ?? ""));

const ranges = (form: FormData, field = "product") => `/catalog/products/${key(form, field)}/availability-ranges`;

async function run(path: string, method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, failure: string): Promise<StepResult> {
  const result = await sendStep(path, method, body, failure);
  if (result.done) {
    revalidatePath("/catalogo/cupos");
    revalidatePath("/catalogo/salidas");
  }
  return result;
}

export async function createRange(_state: StepResult, form: FormData): Promise<StepResult> {
  if (!form.get("product_id")) return { message: "Elige el producto.", done: false };
  return run(ranges(form, "product_id"), "POST", formValues(form, RANGE_FIELDS), "No pudimos crear el rango.");
}

export async function updateRange(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`${ranges(form)}/${key(form, "code")}`, "PATCH", formValues(form, RANGE_FIELDS), "No pudimos guardar el rango.");
}

export async function deleteRange(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`${ranges(form)}/${key(form, "code")}`, "DELETE", formValues(form, ["reason"]), "No pudimos eliminar el rango.");
}

export async function createHold(_state: StepResult, form: FormData): Promise<StepResult> {
  return run("/catalog/holds", "POST", formValues(form, ["departure_id", "quantity", "minutes", "reference", "notes"]), "No pudimos bloquear los cupos.");
}

export async function changeHold(_state: StepResult, form: FormData): Promise<StepResult> {
  const action = String(form.get("action") ?? "");
  if (!["confirm", "release", "consume"].includes(action)) return { message: "Acción no válida.", done: false };
  return run(`/catalog/holds/${key(form, "ref")}/${action}`, "POST", formValues(form, ["reason", "lock_version"]), "No pudimos actualizar el bloqueo.");
}

export async function expireHolds(): Promise<StepResult> {
  return run("/catalog/holds/expire", "POST", {}, "No pudimos expirar los bloqueos.");
}
