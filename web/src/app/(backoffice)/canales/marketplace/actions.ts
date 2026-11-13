"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function refresh(result: StepResult): StepResult {
  if (result.done) revalidatePath("/canales/marketplace");
  return result;
}

export async function saveListing(_state: StepResult, form: FormData): Promise<StepResult> {
  const id = text(form, "id");
  if (id) return refresh(await sendStep(`/marketplace/listings/${encodeURIComponent(id)}`, "PATCH", { ...formValues(form, ["title", "summary", "reseller_commission_pct", "status"]), refresh_price: text(form, "refresh_price") === "1" }, "No pudimos guardar la publicación."));
  return refresh(await sendStep("/marketplace/listings", "POST", { ...formValues(form, ["product", "title", "summary", "reseller_commission_pct"]), publish: text(form, "publish") === "1" }, "No pudimos publicar el producto."));
}

export async function requestPartnership(_state: StepResult, form: FormData): Promise<StepResult> {
  return refresh(await sendStep("/marketplace/partnerships", "POST", formValues(form, ["listing", "payment_terms", "credit_limit"]), "No pudimos enviar la solicitud."));
}

export async function decidePartnership(_state: StepResult, form: FormData): Promise<StepResult> {
  return refresh(await sendStep(`/marketplace/partnerships/${encodeURIComponent(text(form, "id"))}/decide`, "POST", formValues(form, ["decision"]), "No pudimos registrar la decisión."));
}

export async function sellListing(_state: StepResult, form: FormData): Promise<StepResult> {
  return refresh(await sendStep("/marketplace/orders", "POST", { ...formValues(form, ["listing", "travel_date", "gross_amount"]), pax: Number(text(form, "pax") || "1") }, "No pudimos registrar la venta."));
}
