"use server";

import { revalidatePath } from "next/cache";
import type { PaxSimulation } from "@/lib/catalog-booking";
import { apiFetch } from "@/lib/server/api";
import { sendStep, type StepResult } from "@/lib/server/resource";

const text = (form: FormData, field: string): string | null => {
  const raw = form.get(field);
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
};

const number = (form: FormData, field: string): number | null => {
  const raw = text(form, field);
  return raw === null ? null : Number(raw);
};

const flag = (form: FormData, field: string): boolean => form.get(field) === "on";

const list = (form: FormData, field: string): string[] => form.getAll(field).filter((value): value is string => typeof value === "string" && value !== "");

const json = <T,>(form: FormData, field: string): T[] => {
  try {
    const parsed = JSON.parse(String(form.get(field) ?? "[]"));
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

const base = (form: FormData) => `/catalog/products/${encodeURIComponent(String(form.get("product") ?? ""))}`;

const segment = (form: FormData, field: string) => encodeURIComponent(String(form.get(field) ?? ""));

const version = (form: FormData) => ({ lock_version: number(form, "lock_version") });

async function run(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body: Record<string, unknown>, failure: string): Promise<StepResult> {
  const result = await sendStep(path, method, body, failure);
  if (result.done) revalidatePath("/catalogo/productos", "layout");
  return result;
}

export async function saveOperation(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`${base(form)}/operation`, "PUT", { ...version(form), operating_weekdays: list(form, "operating_weekdays").map(Number), cutoff_hours: number(form, "cutoff_hours") }, "No pudimos guardar los días de operación.");
}

export async function savePaxRules(_state: StepResult, form: FormData): Promise<StepResult> {
  const body = {
    ...version(form),
    adult_min_age: number(form, "adult_min_age"),
    child_min_age: number(form, "child_min_age"),
    child_max_age: number(form, "child_max_age"),
    infant_max_age: number(form, "infant_max_age"),
    child_pays: flag(form, "child_pays"),
    child_price_pct: number(form, "child_price_pct") ?? 0,
    infant_allowed: flag(form, "infant_allowed"),
    infant_pays: flag(form, "infant_pays"),
    max_children_per_adult: number(form, "max_children_per_adult"),
    max_infants_per_adult: number(form, "max_infants_per_adult"),
    min_adults: number(form, "min_adults"),
    note: text(form, "note"),
  };
  return run(`${base(form)}/pax-rules`, "PUT", body, "No pudimos guardar las reglas de pasajeros.");
}

export async function resetPaxRules(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`${base(form)}/pax-rules`, "DELETE", version(form), "No pudimos restablecer las reglas de pasajeros.");
}

export async function saveAddon(_state: StepResult, form: FormData): Promise<StepResult> {
  const addon = text(form, "addon");
  const body = {
    ...version(form),
    name: text(form, "name"),
    category: text(form, "category"),
    price: number(form, "price"),
    currency: text(form, "currency"),
    charge_per: text(form, "charge_per"),
    applies_to: list(form, "applies_to"),
    stock_note: text(form, "stock_note"),
    provider_id: text(form, "provider_id"),
    service_id: text(form, "service_id"),
    is_optional: flag(form, "is_optional"),
  };
  return addon ? run(`${base(form)}/addons/${encodeURIComponent(addon)}`, "PATCH", body, "No pudimos guardar el adicional.") : run(`${base(form)}/addons`, "POST", body, "No pudimos crear el adicional.");
}

export async function deleteAddon(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`${base(form)}/addons/${segment(form, "addon")}`, "DELETE", version(form), "No pudimos eliminar el adicional.");
}

export async function saveAccommodation(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`${base(form)}/accommodation`, "PUT", { ...version(form), enabled: flag(form, "enabled"), optional: flag(form, "optional"), currency: text(form, "currency"), note: text(form, "note") }, "No pudimos guardar el alojamiento.");
}

export async function saveLeg(_state: StepResult, form: FormData): Promise<StepResult> {
  const leg = text(form, "leg");
  const body = { ...version(form), city: text(form, "city"), nights: number(form, "nights"), destination_id: text(form, "destination_id"), sequence: number(form, "sequence") };
  return leg ? run(`${base(form)}/accommodation/legs/${encodeURIComponent(leg)}`, "PATCH", body, "No pudimos guardar el tramo.") : run(`${base(form)}/accommodation/legs`, "POST", body, "No pudimos crear el tramo.");
}

export async function deleteLeg(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`${base(form)}/accommodation/legs/${segment(form, "leg")}`, "DELETE", version(form), "No pudimos eliminar el tramo.");
}

export async function reorderLegs(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`${base(form)}/accommodation/legs/reorder`, "POST", { ...version(form), ids: json<string>(form, "ids") }, "No pudimos cambiar el orden de los tramos.");
}

export async function saveHotel(_state: StepResult, form: FormData): Promise<StepResult> {
  const hotel = text(form, "hotel");
  const rooms = list(form, "room_types")
    .map((type) => ({ room_type: type, capacity: number(form, `capacity_${type}`), price_per_night: number(form, `price_${type}`) }))
    .filter((room) => room.price_per_night !== null);
  const body = { ...version(form), name: text(form, "name"), category: text(form, "category"), provider_id: text(form, "provider_id"), room_types: rooms };
  const path = `${base(form)}/accommodation/legs/${segment(form, "leg")}/hotels`;
  return hotel ? run(`${path}/${encodeURIComponent(hotel)}`, "PATCH", body, "No pudimos guardar el hotel.") : run(path, "POST", body, "No pudimos agregar el hotel.");
}

export async function deleteHotel(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`${base(form)}/accommodation/legs/${segment(form, "leg")}/hotels/${segment(form, "hotel")}`, "DELETE", version(form), "No pudimos eliminar el hotel.");
}

export async function savePayment(_state: StepResult, form: FormData): Promise<StepResult> {
  const body = {
    ...version(form),
    modes: list(form, "modes"),
    deposit_pct: number(form, "deposit_pct"),
    balance_due_days: number(form, "balance_due_days"),
    note: text(form, "note"),
    ...(form.has("pay_later_shown") ? { pay_later_enabled: flag(form, "pay_later_enabled") } : {}),
  };
  return run(`${base(form)}/payment-policy`, "PUT", body, "No pudimos guardar la política de pago.");
}

export async function resetPayment(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`${base(form)}/payment-policy`, "DELETE", version(form), "No pudimos restablecer la política de pago.");
}

export async function savePickup(_state: StepResult, form: FormData): Promise<StepResult> {
  const points = json<{ label?: string }>(form, "points")
    .map((point) => ({ label: String(point.label ?? "").trim() }))
    .filter((point) => point.label !== "");
  return run(`${base(form)}/pickup`, "PUT", { ...version(form), required: flag(form, "required"), ask_flight: flag(form, "ask_flight"), points }, "No pudimos guardar el recojo.");
}

export async function saveRuleOverride(_state: StepResult, form: FormData): Promise<StepResult> {
  const keys = list(form, "param_keys");
  const params = Object.fromEntries(keys.map((key) => [key, form.get(`bool_${key}`) !== null ? flag(form, `param_${key}`) : (text(form, `param_${key}`) ?? "")]));
  const body = { ...version(form), enabled: flag(form, "enabled"), ...(keys.length ? { params } : {}) };
  return run(`${base(form)}/rule-overrides/${segment(form, "rule")}`, "PUT", body, "No pudimos guardar la regla del producto.");
}

export async function resetRuleOverride(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`${base(form)}/rule-overrides/${segment(form, "rule")}`, "DELETE", version(form), "No pudimos restablecer la regla.");
}

export async function simulatePax(code: string, pax: { adt: number; chd: number; inf: number; ages: number[] }): Promise<{ ok: true; data: PaxSimulation } | { ok: false; message: string }> {
  const result = await apiFetch<PaxSimulation>(`/catalog/products/${encodeURIComponent(code)}/pax-rules/simulate`, { method: "POST", body: pax });
  if (!result.ok || !result.data) {
    const first = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { ok: false, message: first ?? result.error?.message ?? "No pudimos simular." };
  }
  return { ok: true, data: result.data };
}
