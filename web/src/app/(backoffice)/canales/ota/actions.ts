"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function refresh(result: StepResult): StepResult {
  if (result.done) revalidatePath("/canales/ota");
  return result;
}

export async function saveOtaConnection(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = text(form, "code");
  const body = { ...formValues(form, ["name", "account_ref", "commission_pct", "markup_pct"]), sync_availability: text(form, "sync_availability") === "1" };
  if (text(form, "api_key") !== "") Object.assign(body, { api_key: text(form, "api_key") });
  if (code) return refresh(await sendStep(`/channels/ota/connections/${encodeURIComponent(code)}`, "PATCH", { ...body, lock_version: Number(text(form, "lock_version")) }, "No pudimos guardar la conexión."));
  return refresh(await sendStep("/channels/ota/connections", "POST", { ...body, ota: text(form, "ota") }, "No pudimos conectar la OTA."));
}

export async function otaConnectionStep(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = encodeURIComponent(text(form, "code"));
  const step = text(form, "step");
  if (step === "sync") return refresh(await sendStep(`/channels/ota/connections/${code}/sync`, "POST", {}, "No pudimos sincronizar."));
  return refresh(await sendStep(`/channels/ota/connections/${code}`, "PATCH", { action: step, lock_version: Number(text(form, "lock_version")) }, "No pudimos cambiar el estado de la conexión."));
}

export async function saveOtaMapping(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = encodeURIComponent(text(form, "code"));
  const product = encodeURIComponent(text(form, "product"));
  if (!product) return { message: "Elige el producto del catálogo.", done: false };
  return refresh(await sendStep(`/channels/ota/connections/${code}/mappings/${product}`, "PUT", formValues(form, ["ota_product_ref", "ota_option_ref", "price_mode", "fixed_price", "status"]), "No pudimos guardar el mapeo."));
}
