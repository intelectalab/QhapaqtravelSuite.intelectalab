"use server";

import { revalidatePath } from "next/cache";
import { sendStep, type StepResult } from "@/lib/server/resource";

const text = (form: FormData, field: string): string | null => {
  const raw = form.get(field);
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : null;
};

const number = (form: FormData, field: string): number | null => {
  const raw = text(form, field);
  return raw === null ? null : Number(raw);
};

const flag = (form: FormData, field: string): boolean => form.get(field) === "on" || form.get(field) === "true";

const product = (form: FormData) => `/catalog/products/${encodeURIComponent(String(form.get("product") ?? ""))}`;

async function run(path: string, method: "POST" | "PATCH" | "PUT" | "DELETE", body: Record<string, unknown>, failure: string): Promise<StepResult> {
  const result = await sendStep(path, method, body, failure);
  if (result.done) revalidatePath("/catalogo/productos", "layout");
  return result;
}

export async function saveLegNights(_state: StepResult, form: FormData): Promise<StepResult> {
  const flexible = flag(form, "flexible");
  return run(`${product(form)}/trip/legs/${encodeURIComponent(String(form.get("leg") ?? ""))}/nights`, "PUT", { lock_version: number(form, "lock_version"), min_nights: flexible ? number(form, "min_nights") : null, max_nights: flexible ? number(form, "max_nights") : null }, "No pudimos guardar las noches del tramo.");
}

export async function createSeasonRate(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`/catalog/hotels/${encodeURIComponent(String(form.get("hotel") ?? ""))}/season-rates`, "POST", { label: text(form, "label"), date_from: text(form, "date_from"), date_to: text(form, "date_to"), adjust_pct: number(form, "adjust_pct") }, "No pudimos crear la temporada.");
}

export async function deleteSeasonRate(_state: StepResult, form: FormData): Promise<StepResult> {
  return run(`/catalog/hotels/${encodeURIComponent(String(form.get("hotel") ?? ""))}/season-rates/${encodeURIComponent(String(form.get("rate") ?? ""))}`, "DELETE", {}, "No pudimos borrar la temporada.");
}

export async function saveLegTour(_state: StepResult, form: FormData): Promise<StepResult> {
  const tour = text(form, "tour");
  const body = {
    leg_id: text(form, "leg_id"),
    name: text(form, "name"),
    day_offset: number(form, "day_offset") ?? 0,
    start_time: text(form, "start_time"),
    duration_hours: number(form, "duration_hours"),
    currency: text(form, "currency"),
    price_adult: number(form, "price_adult"),
    price_child: number(form, "price_child") ?? 0,
    min_age: number(form, "min_age"),
    capacity: number(form, "capacity"),
    provider_id: text(form, "provider_id"),
    in_trip_sale: flag(form, "in_trip_sale"),
    active: flag(form, "active"),
  };
  return tour ? run(`${product(form)}/trip/tours/${encodeURIComponent(tour)}`, "PATCH", body, "No pudimos guardar el tour.") : run(`${product(form)}/trip/tours`, "POST", body, "No pudimos crear el tour.");
}

export async function saveTransportOption(_state: StepResult, form: FormData): Promise<StepResult> {
  const option = text(form, "option");
  const pricing = text(form, "pricing") ?? "pax";
  const vehicles = ["1", "2", "3"]
    .map((slot) => ({ name: text(form, `vehicle_name_${slot}`), max_pax: number(form, `vehicle_pax_${slot}`), price: number(form, `vehicle_price_${slot}`) }))
    .filter((vehicle) => vehicle.name !== null && vehicle.max_pax !== null && vehicle.price !== null);
  const body = {
    from_leg_id: text(form, "from_leg_id"),
    to_leg_id: text(form, "to_leg_id"),
    mode: text(form, "mode"),
    name: text(form, "name"),
    pricing,
    currency: text(form, "currency"),
    price_adult: pricing === "pax" ? number(form, "price_adult") : null,
    price_child: pricing === "pax" ? number(form, "price_child") : null,
    duration_hours: number(form, "duration_hours"),
    provider_id: text(form, "provider_id"),
    in_trip_sale: flag(form, "in_trip_sale"),
    active: flag(form, "active"),
    ...(pricing === "vehiculo" ? { vehicles } : {}),
  };
  return option ? run(`${product(form)}/trip/transport/${encodeURIComponent(option)}`, "PATCH", body, "No pudimos guardar la movilidad.") : run(`${product(form)}/trip/transport`, "POST", body, "No pudimos crear la movilidad.");
}
