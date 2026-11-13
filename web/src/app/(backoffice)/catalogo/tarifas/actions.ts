"use server";

import { revalidatePath } from "next/cache";
import type { PricingResult } from "@/lib/catalog-pricing";
import type { SeasonResolution } from "@/lib/catalog-rates";
import { apiFetch } from "@/lib/server/api";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const RATE_FIELDS = ["rate_type", "segment", "channel", "currency", "price_basis", "cost", "price", "min_price", "max_price", "valid_from", "valid_to", "season_id", "conditions", "reason", "lock_version"];

const SEASON_FIELDS = ["name", "type", "date_from", "date_to", "priority", "factor", "status"];

const ref = (form: FormData) => encodeURIComponent(String(form.get("ref") ?? ""));

const rates = (form: FormData, field = "product") => `/catalog/products/${encodeURIComponent(String(form.get(field) ?? ""))}/rates`;

async function run(path: string, method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>, failure: string): Promise<StepResult> {
  const result = await sendStep(path, method, body, failure);
  if (result.done) revalidatePath("/catalogo/tarifas", "layout");
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

export async function deleteSeason(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`/catalog/seasons/${ref(form)}`, "DELETE", {}, "No pudimos eliminar la temporada.");
}

export async function resolveSeason(date: string): Promise<{ data: SeasonResolution | null; message: string | null }> {
  const result = await apiFetch<SeasonResolution>(`/catalog/seasons/resolve?date=${encodeURIComponent(date)}`);
  if (!result.ok || !result.data) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { data: null, message: firstError ?? result.error?.message ?? "No pudimos resolver la temporada." };
  }
  return { data: result.data, message: null };
}

const RULE_FIELDS = ["name", "kind", "value", "scope", "channel", "min_pax", "residency", "product_id", "currency", "priority"];

export async function createPriceRule(_state: StepResult, form: FormData): Promise<StepResult> {
  return run("/catalog/price-rules", "POST", formValues(form, RULE_FIELDS), "No pudimos crear la regla.");
}

export async function updatePriceRule(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`/catalog/price-rules/${ref(form)}`, "PATCH", formValues(form, RULE_FIELDS), "No pudimos guardar la regla.");
}

export async function togglePriceRule(_state: StepResult, form: FormData): Promise<StepResult> {
  const action = form.get("action") === "activate" ? "activate" : "deactivate";
  return run(`/catalog/price-rules/${ref(form)}/${action}`, "POST", {}, "No pudimos cambiar el estado de la regla.");
}

export async function deletePriceRule(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`/catalog/price-rules/${ref(form)}`, "DELETE", formValues(form, ["reason"]), "No pudimos eliminar la regla.");
}

export async function simulatePrice(input: Record<string, string | number | null>): Promise<{ data: PricingResult | null; message: string | null }> {
  const result = await apiFetch<PricingResult>("/catalog/pricing/simulate", { method: "POST", body: input });
  if (!result.ok || !result.data) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { data: null, message: firstError ?? result.error?.message ?? "No pudimos simular el precio." };
  }
  return { data: result.data, message: null };
}
