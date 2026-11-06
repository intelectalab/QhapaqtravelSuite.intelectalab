"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const FIELDS = ["product_id", "departure_date", "departure_time", "capacity", "status", "provider_id", "guide_id", "vehicle_id", "meeting_point", "return_point", "notes", "lock_version"];

const ref = (form: FormData) => encodeURIComponent(String(form.get("ref") ?? ""));

async function run(path: string, method: "POST" | "PATCH", body: Record<string, unknown>, failure: string): Promise<StepResult> {
  const result = await sendStep(path, method, body, failure);
  if (result.done) {
    revalidatePath("/catalogo/salidas");
    revalidatePath("/catalogo/cupos");
  }
  return result;
}

export async function createDeparture(_state: StepResult, form: FormData): Promise<StepResult> {
  return run("/catalog/departures", "POST", formValues(form, FIELDS), "No pudimos crear la salida.");
}

export async function updateDeparture(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`/catalog/departures/${ref(form)}`, "PATCH", formValues(form, FIELDS), "No pudimos guardar la salida.");
}

export async function closeDeparture(_state: StepResult, form: FormData): Promise<StepResult> {
  const action = form.get("action") === "cancel" ? "cancel" : "close";
  return run(`/catalog/departures/${ref(form)}/${action}`, "POST", formValues(form, ["reason"]), "No pudimos cambiar la salida.");
}
