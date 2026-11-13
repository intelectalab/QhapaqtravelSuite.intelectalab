"use server";

import { revalidatePath } from "next/cache";
import type { PriceSimulation } from "@/lib/growth";
import { apiFetch } from "@/lib/server/api";
import { sendStep, type StepResult } from "@/lib/server/resource";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

const optionalNumber = (form: FormData, key: string, scale = 1): number | undefined => (text(form, key) === "" ? undefined : Number(text(form, key)) * scale);

function refresh(result: StepResult): StepResult {
  if (result.done) revalidatePath("/catalogo/precios-dinamicos");
  return result;
}

function conditions(form: FormData): Record<string, unknown> {
  const basis = text(form, "basis");
  const entries: Record<string, unknown> = {
    ocupacion: { occupancy_gte: optionalNumber(form, "min", 0.01), occupancy_lte: optionalNumber(form, "max", 0.01) },
    demanda: { demand_gte: optionalNumber(form, "min", 0.01), demand_lte: optionalNumber(form, "max", 0.01) },
    anticipacion: { days_before_gte: optionalNumber(form, "min"), days_before_lte: optionalNumber(form, "max") },
    dia_semana: { weekdays: form.getAll("weekdays").map(Number) },
    temporada: { from: text(form, "season_from") || undefined, to: text(form, "season_to") || undefined },
  };
  return Object.fromEntries(Object.entries((entries[basis] ?? {}) as Record<string, unknown>).filter(([, value]) => value !== undefined));
}

export async function savePriceRule(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = text(form, "code");
  const body: Record<string, unknown> = {
    name: text(form, "name"),
    product: text(form, "product") === "*" ? null : text(form, "product") || null,
    basis: text(form, "basis"),
    conditions: conditions(form),
    adjust_pct: Number(text(form, "adjust_pct")),
    floor_pct: Number(text(form, "floor_pct") || "-30"),
    ceiling_pct: Number(text(form, "ceiling_pct") || "50"),
    priority: Number(text(form, "priority") || "100"),
    channels: form.getAll("channels").map(String),
    valid_from: text(form, "valid_from") || null,
    valid_to: text(form, "valid_to") || null,
    active: text(form, "active") === "1",
  };
  if (code) body.lock_version = Number(text(form, "lock_version"));
  return refresh(await sendStep(code ? `/catalog/dynamic-price-rules/${encodeURIComponent(code)}` : "/catalog/dynamic-price-rules", code ? "PATCH" : "POST", body, "No pudimos guardar la regla."));
}

export async function togglePriceRule(_state: StepResult, form: FormData): Promise<StepResult> {
  return refresh(await sendStep(`/catalog/dynamic-price-rules/${encodeURIComponent(text(form, "code"))}`, "PATCH", { active: text(form, "active") === "1", lock_version: Number(text(form, "lock_version")) }, "No pudimos cambiar la regla."));
}

export interface SimulationState {
  message: string | null;
  result: PriceSimulation | null;
}

export async function simulatePrice(_state: SimulationState, form: FormData): Promise<SimulationState> {
  const body = {
    product: text(form, "product") === "*" ? null : text(form, "product") || null,
    date: text(form, "date"),
    channel: text(form, "channel"),
    occupancy: optionalNumber(form, "occupancy", 0.01) ?? 0,
    demand: optionalNumber(form, "demand", 0.01) ?? 0,
    base_price: text(form, "base_price") || null,
    include_inactive: text(form, "include_inactive") === "1",
  };
  const result = await apiFetch<PriceSimulation>("/catalog/dynamic-price-rules/simulate", { method: "POST", body });
  if (!result.ok || !result.data) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? "No pudimos simular el precio.", result: null };
  }
  return { message: null, result: result.data };
}
