"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const done = (result: StepResult) => {
  if (result.done) revalidatePath("/canales/integracion-web", "layout");
  return result;
};

export async function saveWidgetDefaults(_state: StepResult, form: FormData): Promise<StepResult> {
  const body = { ...formValues(form, ["mode", "category", "product", "method", "lang", "currency", "theme", "radius", "domain"]), reviews: form.get("reviews") === "on" };
  return done(await sendStep("/channels/widget", "PUT", body, "No pudimos guardar la configuración del widget."));
}

export async function addDomain(_state: StepResult, form: FormData): Promise<StepResult> {
  return done(await sendStep("/channels/widget/domains", "POST", formValues(form, ["domain", "cms"]), "No pudimos registrar el dominio."));
}

export async function verifyDomain(_state: StepResult, form: FormData): Promise<StepResult> {
  const result = await apiFetch<{ status: string; message: string | null }>(`/channels/widget/domains/${encodeURIComponent(String(form.get("id") ?? ""))}/verify`, { method: "POST", body: {} });
  if (!result.ok || !result.data) return { message: result.error?.message ?? "No pudimos verificar el dominio.", done: false };
  revalidatePath("/canales/integracion-web", "layout");
  if (result.data.status !== "verificado") return { message: result.data.message ?? "Todavía no encontramos el registro TXT en tu DNS.", done: false };
  return { message: null, done: true };
}

export async function removeDomain(_state: StepResult, form: FormData): Promise<StepResult> {
  return done(await sendStep(`/channels/widget/domains/${encodeURIComponent(String(form.get("id") ?? ""))}`, "DELETE", {}, "No pudimos quitar el dominio."));
}

export async function rotateWidgetKey(_state: StepResult, form: FormData): Promise<StepResult> {
  return done(await sendStep("/channels/widget/rotate-key", "POST", formValues(form, ["reason"]), "No pudimos regenerar la clave pública."));
}
