"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const done = (result: StepResult) => {
  if (result.done) revalidatePath("/canales/integracion-web");
  return result;
};

export async function saveWidgetDefaults(_state: StepResult, form: FormData): Promise<StepResult> {
  const body = { ...formValues(form, ["product", "method", "lang", "currency", "theme", "radius", "domain"]), reviews: form.get("reviews") === "on" };
  return done(await sendStep("/channels/widget", "PUT", body, "No pudimos guardar la configuración del widget."));
}

export async function addDomain(_state: StepResult, form: FormData): Promise<StepResult> {
  return done(await sendStep("/channels/widget/domains", "POST", formValues(form, ["domain", "cms"]), "No pudimos registrar el dominio."));
}

export async function verifyDomain(_state: StepResult, form: FormData): Promise<StepResult> {
  return done(await sendStep(`/channels/widget/domains/${encodeURIComponent(String(form.get("id") ?? ""))}/verify`, "POST", {}, "No pudimos verificar el dominio."));
}

export async function removeDomain(_state: StepResult, form: FormData): Promise<StepResult> {
  return done(await sendStep(`/channels/widget/domains/${encodeURIComponent(String(form.get("id") ?? ""))}`, "DELETE", {}, "No pudimos quitar el dominio."));
}
