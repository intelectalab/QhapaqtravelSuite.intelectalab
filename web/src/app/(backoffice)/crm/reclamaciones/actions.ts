"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const SHEET = ["type", "consumer_name", "consumer_doc_type", "consumer_doc_number", "consumer_email", "consumer_phone", "consumer_address", "good_kind", "good_description", "good_amount", "good_currency", "detail", "request", "client", "reservation"];

const GUARDIAN = ["guardian_name", "guardian_doc_type", "guardian_doc_number", "guardian_relation"];

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function refresh(result: StepResult): StepResult {
  if (result.done) revalidatePath("/crm/reclamaciones", "layout");
  return result;
}

export async function saveClaim(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = text(form, "code");
  if (code) return refresh(await sendStep(`/crm/claim-book/${encodeURIComponent(code)}`, "PATCH", formValues(form, SHEET), "No pudimos guardar la hoja."));
  const body = { ...formValues(form, ["sede_id", ...SHEET, ...GUARDIAN]), is_minor: form.get("is_minor") === "on", email_consent: form.get("email_consent") === "on" };
  return refresh(await sendStep("/crm/claim-book", "POST", body, "No pudimos registrar la hoja."));
}

export async function claimStep(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = encodeURIComponent(text(form, "code"));
  const step = text(form, "step");
  const failure = "No pudimos actualizar la hoja.";
  if (step === "evaluate") return refresh(await sendStep(`/crm/claim-book/${code}/review`, "POST", formValues(form, ["lock_version", "owner_id", "note"]), failure));
  if (step === "resend") return refresh(await sendStep(`/crm/claim-book/${code}/response/resend`, "POST", {}, "No pudimos reenviar la respuesta."));
  if (step === "respond") return refresh(await sendStep(`/crm/claim-book/${code}/response`, "POST", formValues(form, ["decision", "text", "actions"]), failure));
  if (step === "close") return refresh(await sendStep(`/crm/claim-book/${code}/close`, "POST", formValues(form, ["reason", "note", "lock_version"]), failure));
  if (step === "note") return refresh(await sendStep(`/crm/claim-book/${code}/notes`, "POST", formValues(form, ["note"]), "No pudimos guardar la nota."));
  if (step === "links") return refresh(await sendStep(`/crm/claim-book/${code}/links`, "PATCH", { client: text(form, "client") || null, reservation: text(form, "reservation") || null }, "No pudimos actualizar los vínculos."));
  if (step === "alerts") return refresh(await sendStep("/crm/claim-book/deadline-alerts", "POST", {}, "No pudimos enviar los avisos de vencimiento."));
  return { message: null, done: true };
}

export interface ClaimExportResult extends StepResult {
  exportId?: string;
  rows?: number;
}

export async function requestClaimExport(_state: ClaimExportResult, form: FormData): Promise<ClaimExportResult> {
  const result = await apiFetch<{ data: { export_id: string; rows: number } }>("/crm/claim-book/exports", { method: "POST", body: formValues(form, ["year", "format"]) });
  if (!result.ok || !result.data) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? "No pudimos generar la relación.", done: false };
  }
  return { message: null, done: true, exportId: result.data.data.export_id, rows: result.data.data.rows };
}

function holidayList(form: FormData): { date: string; name: string }[] {
  try {
    const parsed: unknown = JSON.parse(text(form, "current") || "[]");
    return Array.isArray(parsed) ? parsed.filter((row): row is { date: string; name: string } => typeof row?.date === "string" && typeof row?.name === "string") : [];
  } catch {
    return [];
  }
}

export async function claimHolidayStep(_state: StepResult, form: FormData): Promise<StepResult> {
  const current = holidayList(form);
  const date = text(form, "date");
  const holidays = text(form, "step") === "remove" ? current.filter((row) => row.date !== date) : [...current.filter((row) => row.date !== text(form, "original")), { date, name: text(form, "name") }];
  return refresh(await sendStep("/crm/claim-book/settings", "PUT", { holidays }, "No pudimos guardar los feriados."));
}

export async function saveClaimSettings(_state: StepResult, form: FormData): Promise<StepResult> {
  return refresh(await sendStep("/crm/claim-book/settings", "PUT", formValues(form, ["response_days", "alert_days", "retention_years"]), "No pudimos guardar los parámetros del libro."));
}
