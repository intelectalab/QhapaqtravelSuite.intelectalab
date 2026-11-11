"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const MAX_BYTES = 10 * 1024 * 1024;

const done = (result: StepResult) => {
  if (result.done) revalidatePath("/operaciones/documentos-viaje", "layout");
  return result;
};

const days = (form: FormData) =>
  String(form.get("reminder_days") ?? "")
    .split(/[\s,;]+/)
    .filter(Boolean)
    .map(Number);

export async function saveTravelDocRules(_state: StepResult, form: FormData): Promise<StepResult> {
  const reminders = days(form);
  if (reminders.length === 0 || reminders.some((day) => !Number.isInteger(day))) return { message: "Escribe los días como números separados por comas.", done: false };
  const months = Number(form.get("passport_months") ?? "");
  if (!Number.isInteger(months)) return { message: "Escribe los meses de vigencia del pasaporte como un número entero.", done: false };
  const nationalities = String(form.get("visa_nationalities") ?? "")
    .split(/[,;\n]+/)
    .map((value) => value.trim())
    .filter(Boolean);
  const channels = form.getAll("channels").filter((value): value is string => typeof value === "string" && value !== "");
  if (channels.length === 0) return { message: "Elige al menos un canal de aviso.", done: false };
  const trekking = ["1", "on", "true"].includes(String(form.get("insurance_trekking") ?? ""));
  return done(await sendStep("/settings/travel-docs", "PUT", { reminder_days: reminders, passport_months: months, visa_nationalities: nationalities, channels, insurance_trekking: trekking }, "No pudimos guardar las reglas."));
}

export async function runReminders(): Promise<StepResult> {
  return done(await sendStep("/ops/travel-docs/jobs/reminders", "POST", {}, "No pudimos ejecutar los recordatorios."));
}

export async function uploadTravelDoc(target: string, _state: StepResult, form: FormData): Promise<StepResult> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { message: "Elige el archivo del documento.", done: false };
  if (file.size > MAX_BYTES) return { message: `${file.name} pesa más de 10 MB.`, done: false };
  const payload = new FormData();
  payload.set("file", file, file.name);
  for (const field of ["doc_number", "expiry_date", "note"]) {
    const value = form.get(field);
    if (typeof value === "string" && value.trim() !== "") payload.set(field, value.trim());
  }
  const result = await apiFetch(`/reservations/${target}/files`, { method: "POST", form: payload });
  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? "No pudimos subir el documento.", done: false };
  }
  return done({ message: null, done: true });
}

export async function saveEmergencyContact(target: string, _state: StepResult, form: FormData): Promise<StepResult> {
  return done(await sendStep(`/reservations/${target}/emergency-contact`, "PUT", formValues(form, ["name", "phone", "relation"]), "No pudimos guardar el contacto."));
}

export async function saveSpecialAttention(target: string, _state: StepResult, form: FormData): Promise<StepResult> {
  const flag = ["1", "on", "true"].includes(String(form.get("requires_attention") ?? ""));
  return done(await sendStep(`/reservations/${target}/special-attention`, "PUT", { requires_attention: flag, ...formValues(form, ["operational_note"]) }, "No pudimos guardar la atención especial."));
}

export async function requestTravelDocs(code: string, _state: StepResult, form: FormData): Promise<StepResult> {
  const channels = form.getAll("channels").filter((value): value is string => typeof value === "string" && value !== "");
  return done(await sendStep(`/reservations/${encodeURIComponent(code)}/travel-docs/requests`, "POST", { channels }, "No pudimos enviar la solicitud al cliente."));
}
