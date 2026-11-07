"use server";

import { revalidatePath } from "next/cache";
import type { ConvertQuoteResponse } from "@/lib/api/types";
import type { QuoteComparison, QuotePreview } from "@/lib/quotes";
import { apiFetch } from "@/lib/server/api";

export interface QuotePayload {
  client_code: string;
  opportunity_code?: string;
  title: string;
  travel_from: string;
  travel_to: string;
  valid_until?: string;
  currency: string;
  pax_adt: number;
  pax_chd: number;
  pax_inf: number;
  discount_pct: number;
  tax_pct: number;
  notes?: string;
  items: { product_code: string; date: string; qty: number; pax: number; segment: string; unit_price?: number }[];
  lock_version?: number;
}

export async function previewQuote(payload: QuotePayload): Promise<{ preview: QuotePreview | null; message: string | null }> {
  const result = await apiFetch<QuotePreview>("/quotes/pricing/preview", { method: "POST", body: payload });
  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { preview: null, message: firstError ?? result.error?.message ?? null };
  }
  return { preview: result.data ?? null, message: null };
}

export async function saveQuote(code: string | null, payload: QuotePayload, version?: number): Promise<{ code: string | null; message: string | null }> {
  const path = code ? `/quotes/${encodeURIComponent(code)}/versions/${version ?? 1}` : "/quotes";
  const result = await apiFetch<{ code: string }>(path, { method: code ? "PUT" : "POST", body: payload });
  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { code: null, message: firstError ?? result.error?.message ?? "No pudimos guardar la cotización." };
  }
  revalidatePath("/cotizaciones", "layout");
  revalidatePath("/crm/oportunidades", "layout");
  return { code: result.data?.code ?? code, message: null };
}

export interface QuoteStepState {
  message: string | null;
  done: boolean;
}

const STEPS: Record<string, { path: string; method: "POST" | "DELETE"; fields: string[]; flags?: string[] }> = {
  send: { path: "send", method: "POST", fields: ["channel", "recipient", "message"] },
  negotiate: { path: "negotiations", method: "POST", fields: ["channel", "note"] },
  version: { path: "versions", method: "POST", fields: [] },
  request: { path: "internal-approval-requests", method: "POST", fields: ["note"] },
  decide: { path: "versions/{version}/internal-approval", method: "POST", fields: ["decision", "note"] },
  approve: { path: "approve", method: "POST", fields: ["approved_by_name", "channel", "ref", "internal_note"], flags: ["internal_approval"] },
  reject: { path: "reject", method: "POST", fields: ["reason"] },
  delete: { path: "", method: "DELETE", fields: ["reason"] },
};

export async function quoteStep(_state: QuoteStepState, form: FormData): Promise<QuoteStepState> {
  const code = String(form.get("code") ?? "");
  const step = STEPS[String(form.get("step") ?? "")];
  if (!step || !code) return { message: "Acción no disponible.", done: false };
  const body: Record<string, unknown> = {};
  for (const field of step.fields) {
    const raw = form.get(field);
    if (typeof raw === "string" && raw.trim() !== "") body[field] = raw.trim();
  }
  for (const flag of step.flags ?? []) {
    const raw = form.get(flag);
    body[flag] = raw === "1" || raw === "on" || raw === "true";
  }
  const lock = Number(form.get("lock_version"));
  if (form.has("lock_version") && Number.isInteger(lock)) body.lock_version = lock;
  const stepPath = step.path.replace("{version}", encodeURIComponent(String(form.get("version") ?? "")));
  const result = await apiFetch(`/quotes/${encodeURIComponent(code)}${stepPath ? `/${stepPath}` : ""}`, { method: step.method, body });
  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? "No pudimos completar la acción.", done: false };
  }
  revalidatePath("/cotizaciones", "layout");
  revalidatePath("/crm/oportunidades", "layout");
  revalidatePath("/dashboard");
  return { message: null, done: true };
}

export interface ConvertState {
  message: string | null;
  done: boolean;
  reservation?: string;
}

export async function convertQuote(_state: ConvertState, form: FormData): Promise<ConvertState> {
  const code = String(form.get("code") ?? "");
  const notes = String(form.get("notes") ?? "").trim();
  const lock = Number(form.get("lock_version"));
  const result = await apiFetch<NonNullable<ConvertQuoteResponse["data"]>>(`/quotes/${encodeURIComponent(code)}/convert`, {
    method: "POST",
    body: { notes: notes || undefined, lock_version: Number.isFinite(lock) ? lock : undefined },
    headers: { "Idempotency-Key": String(form.get("idempotency_key") ?? "") },
  });
  if (!result.ok || !result.data) {
    return { message: result.error?.message ?? "No pudimos crear la reserva.", done: false };
  }
  revalidatePath("/cotizaciones", "layout");
  revalidatePath("/reservas", "layout");
  revalidatePath("/crm/oportunidades", "layout");
  revalidatePath("/dashboard");
  return { message: null, done: true, reservation: result.data.code };
}

export interface QuoteDuplicateState {
  message: string | null;
  done: boolean;
  code?: string;
}

export async function duplicateQuote(_state: QuoteDuplicateState, form: FormData): Promise<QuoteDuplicateState> {
  const code = String(form.get("code") ?? "");
  const note = String(form.get("note") ?? "").trim();
  const result = await apiFetch<{ code: string }>(`/quotes/${encodeURIComponent(code)}/duplicate`, { method: "POST", body: { note: note || undefined } });
  if (!result.ok || !result.data) return { message: result.error?.message ?? "No pudimos duplicar la cotización.", done: false };
  revalidatePath("/cotizaciones", "layout");
  return { message: null, done: true, code: result.data.code };
}

export async function reassignQuote(_state: QuoteStepState, form: FormData): Promise<QuoteStepState> {
  const code = String(form.get("code") ?? "");
  const lock = Number(form.get("lock_version"));
  const result = await apiFetch(`/quotes/${encodeURIComponent(code)}/reassign`, {
    method: "POST",
    body: { owner_id: String(form.get("owner_id") ?? ""), note: String(form.get("note") ?? "").trim() || undefined, lock_version: Number.isInteger(lock) ? lock : undefined },
  });
  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? "No pudimos reasignar la cotización.", done: false };
  }
  revalidatePath("/cotizaciones", "layout");
  return { message: null, done: true };
}

export async function compareVersions(code: string, a: number, b: number): Promise<{ comparison: QuoteComparison | null; message: string | null }> {
  const result = await apiFetch<QuoteComparison>(`/quotes/${encodeURIComponent(code)}/versions/compare?a=${a}&b=${b}`);
  return result.ok && result.data ? { comparison: result.data, message: null } : { comparison: null, message: result.error?.message ?? "No pudimos comparar las versiones." };
}
