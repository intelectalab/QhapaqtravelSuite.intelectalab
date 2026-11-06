"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const FIELDS = ["name", "type", "parent_id", "lat", "lng", "description"];

const ref = (form: FormData) => encodeURIComponent(String(form.get("ref") ?? ""));

async function run(path: string, method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, failure: string): Promise<StepResult> {
  const result = await sendStep(path, method, body, failure);
  if (result.done) revalidatePath("/catalogo/destinos");
  return result;
}

export async function createDestination(_state: StepResult, form: FormData): Promise<StepResult> {
  return run("/catalog/destinations", "POST", formValues(form, FIELDS), "No pudimos crear el destino.");
}

export async function updateDestination(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`/catalog/destinations/${ref(form)}`, "PATCH", formValues(form, FIELDS), "No pudimos guardar el destino.");
}

export async function deleteDestination(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`/catalog/destinations/${ref(form)}`, "DELETE", formValues(form, ["reason"]), "No pudimos eliminar el destino.");
}
