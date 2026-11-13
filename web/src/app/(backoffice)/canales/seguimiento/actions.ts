"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const BASE = "/marketing/tracking";

const done = (result: StepResult) => {
  if (result.done) revalidatePath("/canales/seguimiento", "layout");
  return result;
};

const code = (form: FormData) => encodeURIComponent(String(form.get("code") ?? ""));

const flags = (form: FormData, names: string[]) => Object.fromEntries(names.map((name) => [name, form.get(name) === "on"]));

export async function createTag(_state: StepResult, form: FormData): Promise<StepResult> {
  const body = { ...formValues(form, ["provider", "name", "measurement_id", "pages", "exclude", "secret"]), ...flags(form, ["server_side", "enhanced_conversions"]) };
  return done(await sendStep(`${BASE}/tags`, "POST", body, "No pudimos crear la etiqueta."));
}

export async function updateTag(_state: StepResult, form: FormData): Promise<StepResult> {
  const body = { ...formValues(form, ["name", "measurement_id", "pages", "exclude", "secret"]), ...flags(form, ["server_side", "enhanced_conversions"]), lock_version: Number(form.get("lock_version")) };
  return done(await sendStep(`${BASE}/tags/${code(form)}`, "PATCH", body, "No pudimos guardar la etiqueta."));
}

export async function createScript(_state: StepResult, form: FormData): Promise<StepResult> {
  const body = { provider: "script", submit: true, ...formValues(form, ["name", "consent_category", "script_src", "sri_hash", "script_body", "csp_domains", "placement", "pages"]) };
  return done(await sendStep(`${BASE}/tags`, "POST", body, "No pudimos enviar el script a revisión."));
}

export async function updateScript(_state: StepResult, form: FormData): Promise<StepResult> {
  const body = { ...formValues(form, ["name", "consent_category", "script_src", "sri_hash", "script_body", "csp_domains", "placement", "pages"]), lock_version: Number(form.get("lock_version")) };
  return done(await sendStep(`${BASE}/tags/${code(form)}`, "PATCH", body, "No pudimos guardar el script."));
}

export async function tagAction(_state: StepResult, form: FormData): Promise<StepResult> {
  const action = String(form.get("action") ?? "");
  if (action === "delete") return done(await sendStep(`${BASE}/tags/${code(form)}`, "DELETE", {}, "No pudimos eliminar la etiqueta."));
  if (action === "decision") return done(await sendStep(`${BASE}/tags/${code(form)}/decision`, "POST", formValues(form, ["decision", "reason"]), "No pudimos registrar la decisión."));
  const path = action === "pause" ? "pause" : action === "verify" ? "verify" : "submit";
  return done(await sendStep(`${BASE}/tags/${code(form)}/${path}`, "POST", {}, "No pudimos completar la acción."));
}

export async function saveMapping(_state: StepResult, form: FormData): Promise<StepResult> {
  const target = `${BASE}/conversions/${encodeURIComponent(String(form.get("tag") ?? ""))}/${encodeURIComponent(String(form.get("event") ?? ""))}`;
  if (form.get("remove") === "1") return done(await sendStep(target, "DELETE", {}, "No pudimos quitar el envío."));
  const body = { ...formValues(form, ["provider_event", "conversion_label"]), ...flags(form, ["send_value", "server_side"]) };
  return done(await sendStep(target, "PUT", body, "No pudimos guardar el envío."));
}

export async function retryDispatch(_state: StepResult, form: FormData): Promise<StepResult> {
  return done(await sendStep(`${BASE}/dispatches/${encodeURIComponent(String(form.get("id") ?? ""))}/retry`, "POST", {}, "No pudimos reintentar el envío."));
}
