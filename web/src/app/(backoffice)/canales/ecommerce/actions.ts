"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

export async function cancelOrder(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = String(form.get("code") ?? "");
  const result = await sendStep(`/channels/ecommerce/orders/${encodeURIComponent(code)}/cancel`, "POST", formValues(form, ["reason", "lock_version"]), "No pudimos anular el pedido.");
  if (result.done) revalidatePath("/canales/ecommerce");
  return result;
}

export async function togglePublication(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = String(form.get("code") ?? "");
  const result = await sendStep(`/channels/ecommerce/products/${encodeURIComponent(code)}/${form.get("published") === "1" ? "publish" : "unpublish"}`, "POST", {}, "No pudimos cambiar la publicación.");
  if (result.done) revalidatePath("/canales/ecommerce");
  return result;
}
