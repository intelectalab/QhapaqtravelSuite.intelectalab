"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

export async function cancelOrder(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = String(form.get("code") ?? "");
  const result = await sendStep(`/channels/ecommerce/orders/${encodeURIComponent(code)}/cancel`, "POST", formValues(form, ["reason", "lock_version"]), "No pudimos anular el pedido.");
  if (result.done) revalidatePath("/canales/ecommerce");
  return result;
}

export async function sendPaymentLink(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = String(form.get("code") ?? "");
  const result = await sendStep(`/channels/ecommerce/orders/${encodeURIComponent(code)}/payment-link`, "POST", formValues(form, ["note"]), "No pudimos enviar el enlace de pago.");
  if (result.done) revalidatePath("/canales/ecommerce");
  return result;
}

const PROMOTION_FIELDS = ["name", "kind", "value", "channel", "promo_code", "min_pax", "valid_from", "valid_to"];

export async function promotionStep(_state: StepResult, form: FormData): Promise<StepResult> {
  const product = encodeURIComponent(String(form.get("product") ?? ""));
  const ref = encodeURIComponent(String(form.get("ref") ?? ""));
  const step = String(form.get("step") ?? "");
  const base = `/catalog/products/${product}/promotions`;
  const result =
    step === "create"
      ? await sendStep(base, "POST", formValues(form, PROMOTION_FIELDS), "No pudimos crear la promoción.")
      : step === "update"
        ? await sendStep(`${base}/${ref}`, "PATCH", formValues(form, PROMOTION_FIELDS), "No pudimos guardar la promoción.")
        : step === "delete"
          ? await sendStep(`${base}/${ref}`, "DELETE", {}, "No pudimos eliminar la promoción.")
          : step === "pause" || step === "activate"
            ? await sendStep(`${base}/${ref}/${step}`, "POST", {}, "No pudimos cambiar el estado de la promoción.")
            : { message: "Acción no disponible.", done: false };
  if (result.done) {
    revalidatePath("/canales/ecommerce");
    revalidatePath("/catalogo/productos", "layout");
  }
  return result;
}

export async function togglePublication(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = String(form.get("code") ?? "");
  const result = await sendStep(`/channels/ecommerce/products/${encodeURIComponent(code)}/${form.get("published") === "1" ? "publish" : "unpublish"}`, "POST", {}, "No pudimos cambiar la publicación.");
  if (result.done) revalidatePath("/canales/ecommerce");
  return result;
}
