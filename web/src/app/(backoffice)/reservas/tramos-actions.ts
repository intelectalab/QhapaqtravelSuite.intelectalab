"use server";

import { revalidatePath } from "next/cache";
import { sendStep, type StepResult } from "@/lib/server/resource";

const value = (form: FormData, field: string): string => String(form.get(field) ?? "").trim();

export async function offerInTrip(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = value(form, "reservation");
  const [kind, item] = value(form, "item").split(":");
  const result = await sendStep(`/reservations/${encodeURIComponent(code)}/in-trip-offers`, "POST", { kind, item_id: item, channel: value(form, "channel") || "asesor" }, "No pudimos crear la oferta en ruta.");
  if (result.done) revalidatePath(`/reservas/${code}`);
  return result;
}

export async function cancelInTripOffer(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = value(form, "reservation");
  const result = await sendStep(`/reservations/${encodeURIComponent(code)}/in-trip-offers/${encodeURIComponent(value(form, "offer"))}/cancel`, "POST", {}, "No pudimos cancelar la oferta.");
  if (result.done) revalidatePath(`/reservas/${code}`);
  return result;
}
