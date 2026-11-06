"use server";

import { revalidatePath } from "next/cache";
import type { ChangeImpact, ReschedulePlan } from "@/lib/reservations";
import { apiFetch } from "@/lib/server/api";

export interface ReservationState {
  message: string | null;
  done: boolean;
}

const STEPS: Record<string, { path: (form: FormData) => string; method: "POST" | "PATCH" | "DELETE"; fields: string[]; flags?: string[] }> = {
  update: { path: () => "", method: "PATCH", fields: ["notes", "owner_id"] },
  passenger: { path: (form) => (form.get("passenger") ? `/passengers/${form.get("passenger")}` : "/passengers"), method: "POST", fields: ["full_name", "pax_type", "doc_type", "doc_number", "nationality", "birth_date", "phone", "email", "diet_notes", "relationship"], flags: ["is_lead"] },
  remove_passenger: { path: (form) => `/passengers/${form.get("passenger")}`, method: "DELETE", fields: [] },
  cancel: { path: () => "/cancel", method: "POST", fields: ["reason", "detail"] },
  request_cancel: { path: () => "/cancel-requests", method: "POST", fields: ["reason", "detail"] },
  reject_request: { path: () => "/cancel-requests/reject", method: "POST", fields: ["note"] },
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
  const method = name === "passenger" && form.get("passenger") ? "PATCH" : step.method;
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
