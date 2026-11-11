"use server";

import { revalidatePath } from "next/cache";
import type { ChangeImpact, DirectPayload, DirectPlan, ReschedulePlan } from "@/lib/reservations";
import { apiFetch } from "@/lib/server/api";
import { stepByField, wizardFailure, type WizardResult } from "@/lib/wizard";

export interface ReservationState {
  message: string | null;
  done: boolean;
}

const STEPS: Record<string, { path: (form: FormData) => string; method: "POST" | "PATCH" | "PUT" | "DELETE"; fields: string[]; flags?: string[] }> = {
  update: { path: () => "", method: "PATCH", fields: ["notes"] },
  passenger: { path: (form) => (form.get("passenger") ? `/passengers/${form.get("passenger")}` : "/passengers"), method: "POST", fields: ["full_name", "pax_type", "doc_type", "doc_number", "nationality", "birth_date", "phone", "email", "diet_notes", "relationship"], flags: ["is_lead"] },
  remove_passenger: { path: (form) => `/passengers/${form.get("passenger")}`, method: "DELETE", fields: [] },
  confirm: { path: () => "/confirm", method: "POST", fields: [] },
  start_operation: { path: () => "/start-operation", method: "POST", fields: [] },
  complete: { path: () => "/complete", method: "POST", fields: [] },
  reassign: { path: () => "/reassign", method: "POST", fields: ["owner_id", "note"] },
  generate_receivables: { path: () => "/receivables/generate", method: "POST", fields: [] },
  operation_order: { path: () => "/operation-order", method: "POST", fields: ["coordinator_id"] },
  request_pending: { path: () => "/services/request-pending", method: "POST", fields: [] },
  service_request: { path: (form) => `/services/${form.get("service")}/request`, method: "POST", fields: ["note"] },
  service_confirm: { path: (form) => `/services/${form.get("service")}/confirm`, method: "POST", fields: ["confirmation_code", "time", "confirmed_by"] },
  service_reject: { path: (form) => `/services/${form.get("service")}/reject`, method: "POST", fields: ["reason", "detail", "alternative_date"] },
  cancel: { path: () => "/cancel", method: "POST", fields: ["reason", "detail"] },
  request_cancel: { path: () => "/cancel-requests", method: "POST", fields: ["reason", "detail"] },
  reject_request: { path: (form) => `/cancel-requests/${form.get("request")}/reject`, method: "POST", fields: ["note"] },
  change: { path: () => "/changes", method: "POST", fields: ["type", "extra_pax", "product_code", "service_date", "delta", "description"], flags: ["apply_now"] },
  reschedule: { path: () => "/reschedule", method: "POST", fields: ["new_start", "reason"] },
  approve_change: { path: (form) => `/changes/${form.get("change")}/approve`, method: "POST", fields: [] },
  reject_change: { path: (form) => `/changes/${form.get("change")}/reject`, method: "POST", fields: ["note"] },
};

export async function reservationStep(_state: ReservationState, form: FormData): Promise<ReservationState> {
  const code = String(form.get("code") ?? "");
  const name = String(form.get("step") ?? "");
  const step = STEPS[name];
  if (!step || !code) return { message: "Acción no disponible.", done: false };
  const body: Record<string, unknown> = {};
  for (const field of step.fields) {
    const raw = form.get(field);
    if (typeof raw === "string") body[field] = raw.trim() === "" ? null : raw.trim();
  }
  for (const flag of step.flags ?? []) {
    const raw = form.get(flag);
    body[flag] = raw === "1" || raw === "on" || raw === "true";
  }
  const lock = Number(form.get("lock_version"));
  if (form.has("lock_version") && Number.isInteger(lock)) body.lock_version = lock;
  const method = name === "passenger" && form.get("passenger") ? "PUT" : step.method;
  const result = await apiFetch(`/reservations/${encodeURIComponent(code)}${step.path(form)}`, { method, body });
  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? "No pudimos guardar el cambio.", done: false };
  }
  revalidatePath("/reservas", "layout");
  revalidatePath("/dashboard");
  return { message: null, done: true };
}

export async function previewChange(code: string, payload: Record<string, unknown>): Promise<{ impact: ChangeImpact | null; message: string | null }> {
  const result = await apiFetch<ChangeImpact>(`/reservations/${encodeURIComponent(code)}/changes/preview`, { method: "POST", body: payload });
  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { impact: null, message: firstError ?? result.error?.message ?? null };
  }
  return { impact: result.data ?? null, message: null };
}

export async function previewReschedule(code: string, newStart: string | null): Promise<{ plan: ReschedulePlan | null; message: string | null }> {
  const result = await apiFetch<ReschedulePlan>(`/reservations/${encodeURIComponent(code)}/reschedule/preview`, { method: "POST", body: { new_start: newStart } });
  if (!result.ok) return { plan: null, message: result.error?.message ?? null };
  return { plan: result.data ?? null, message: null };
}

function directBody(payload: DirectPayload): Record<string, unknown> {
  const body: Record<string, unknown> = { product_id: payload.product_id, adt: payload.adt, chd: payload.chd, inf: payload.inf };
  for (const field of ["client_id", "channel", "owner_id", "departure_id", "date", "notes"] as const) {
    if (payload[field].trim() !== "") body[field] = payload[field].trim();
  }
  return body;
}

export async function checkDirectAvailability(payload: DirectPayload): Promise<{ plan: DirectPlan | null; message: string | null }> {
  const result = await apiFetch<DirectPlan>("/reservations/availability-check", { method: "POST", body: directBody(payload) });
  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { plan: null, message: result.error?.message ?? firstError ?? null };
  }
  return { plan: result.data ?? null, message: null };
}

const directStepOf = stepByField({ client_id: 1, channel: 1, owner_id: 1, notes: 1 }, 2);

export async function checkDirectStep(payload: DirectPayload, step: number): Promise<WizardResult<DirectPlan | null>> {
  const result = await apiFetch<DirectPlan | { ready: boolean }>("/reservations/availability-check", { method: "POST", body: { ...directBody(payload), step } });
  if (!result.ok || !result.data) return wizardFailure(result, "No pudimos revisar este paso.", directStepOf);
  return { ok: true, data: "priced" in result.data ? result.data : null };
}

export async function createDirectReservation(payload: DirectPayload, confirm: boolean): Promise<WizardResult<{ code: string }>> {
  const result = await apiFetch<{ code: string }>("/reservations", { method: "POST", body: { ...directBody(payload), confirm } });
  if (!result.ok || !result.data) return wizardFailure(result, "No pudimos crear la reserva.", directStepOf);
  revalidatePath("/reservas", "layout");
  revalidatePath("/dashboard");
  return { ok: true, data: { code: result.data.code } };
}
