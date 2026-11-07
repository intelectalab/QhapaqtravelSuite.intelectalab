"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const RATE_FIELDS = ["rate_type", "segment", "channel", "currency", "price_basis", "cost", "price", "min_price", "max_price", "valid_from", "valid_to", "season_id", "conditions", "reason", "lock_version"];

const SEASON_FIELDS = ["name", "type", "date_from", "date_to", "priority", "factor", "status"];

const ref = (form: FormData) => encodeURIComponent(String(form.get("ref") ?? ""));

const rates = (form: FormData, field = "product") => `/catalog/products/${encodeURIComponent(String(form.get(field) ?? ""))}/rates`;

async function run(path: string, method: "POST" | "PATCH", body: Record<string, unknown>, failure: string): Promise<StepResult> {
  const result = await sendStep(path, method, body, failure);
  if (result.done) revalidatePath("/catalogo/tarifas");
  return result;
}

export async function createRate(_state: StepResult, form: FormData): Promise<StepResult> {
  if (!form.get("product_id")) return { message: "Elige el producto.", done: false };
  return run(rates(form, "product_id"), "POST", formValues(form, RATE_FIELDS), "No pudimos crear la tarifa.");
}

export async function updateRate(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`${rates(form)}/${ref(form)}/price`, "PATCH", formValues(form, RATE_FIELDS), "No pudimos guardar la tarifa.");
}

export async function toggleRate(_state: StepResult, form: FormData): Promise<StepResult> {
  const action = form.get("action") === "activate" ? "activate" : "deactivate";
  return run(`${rates(form)}/${ref(form)}/${action}`, "POST", formValues(form, ["reason"]), "No pudimos cambiar el estado de la tarifa.");
}

export async function createSeason(_state: StepResult, form: FormData): Promise<StepResult> {
  return run("/catalog/seasons", "POST", formValues(form, SEASON_FIELDS), "No pudimos crear la temporada.");
}

export async function updateSeason(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`/catalog/seasons/${ref(form)}`, "PATCH", formValues(form, SEASON_FIELDS), "No pudimos guardar la temporada.");
}

export async function toggleSeason(_state: StepResult, form: FormData): Promise<StepResult> {
  const action = form.get("action") === "activate" ? "activate" : "deactivate";
  return run(`/catalog/seasons/${ref(form)}/${action}`, "POST", {}, "No pudimos cambiar el estado de la temporada.");
}
