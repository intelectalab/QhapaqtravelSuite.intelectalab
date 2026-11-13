"use server";

import { revalidatePath } from "next/cache";
import { type ConsoleResult, platformSend } from "@/lib/server/platformConsole";

const done = (result: ConsoleResult) => {
  if (result.done) revalidatePath("/plataforma/marketing-vitrina", "layout");
  return result;
};

const text = (form: FormData, names: string[]) => Object.fromEntries(names.map((name) => [name, String(form.get(name) ?? "").trim() || null]));

const flags = (form: FormData, names: string[]) => Object.fromEntries(names.map((name) => [name, form.get(name) === "on"]));

const code = (form: FormData) => encodeURIComponent(String(form.get("code") ?? ""));

export async function createPlatformTag(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return done(await platformSend("/tracking/tags", "POST", { ...text(form, ["site", "provider", "name", "measurement_id", "pages", "exclude", "secret"]), ...flags(form, ["server_side", "enhanced_conversions"]) }, "No pudimos crear la etiqueta.", () => "Etiqueta creada en borrador. Envíala a revisión para que otro Super Admin la apruebe."));
}

export async function updatePlatformTag(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return done(await platformSend(`/tracking/tags/${code(form)}`, "PATCH", { ...text(form, ["name", "measurement_id", "pages", "exclude", "secret"]), ...flags(form, ["server_side", "enhanced_conversions"]), lock_version: Number(form.get("lock_version")) }, "No pudimos guardar la etiqueta."));
}

export async function platformTagAction(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  const action = String(form.get("action") ?? "");
  const lock = Number(form.get("lock_version"));

  if (action === "decision") {
    return done(await platformSend(`/tracking/tags/${code(form)}/decision`, "POST", text(form, ["decision", "reason"]), "No pudimos registrar la decisión."));
  }

  const patch = action === "submit" ? "enviar_revision" : String(form.get("status")) === "pausado" ? "reanudar" : "pausar";
  return done(await platformSend(`/tracking/tags/${code(form)}`, "PATCH", { action: action === "pause" ? patch : "enviar_revision", lock_version: lock }, "No pudimos completar la acción."));
}

export async function savePlatformMapping(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  const target = `/tracking/conversions/${encodeURIComponent(String(form.get("tag") ?? ""))}/${encodeURIComponent(String(form.get("event") ?? ""))}`;
  return done(await platformSend(target, "PUT", { ...text(form, ["provider_event", "conversion_label"]), ...flags(form, ["send_value", "server_side"]) }, "No pudimos guardar el envío."));
}
