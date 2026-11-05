"use server";

import { revalidatePath } from "next/cache";
import type { DuplicateMatch } from "@/lib/leads";
import { apiFetch } from "@/lib/server/api";

export interface LeadActionState {
  message: string | null;
  done: boolean;
  matches?: DuplicateMatch[];
  result?: { code?: string; client?: string; opportunity?: string };
}

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
};

const number = (form: FormData, key: string) => {
  const value = text(form, key);
  return value === undefined ? undefined : Number(value);
};

async function send(path: string, body: Record<string, unknown>): Promise<LeadActionState> {
  const result = await apiFetch<LeadActionState["result"]>(path, { method: "POST", body });
  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    const matches = result.error?.details?.matches as DuplicateMatch[] | undefined;
    return { message: firstError ?? result.error?.message ?? "No pudimos guardar el cambio.", done: false, matches };
  }
  revalidatePath("/crm/leads", "layout");
  revalidatePath("/dashboard");
  return { message: null, done: true, result: result.data ?? undefined };
}

export async function createLead(_state: LeadActionState, form: FormData): Promise<LeadActionState> {
  return send("/crm/leads", {
    name: text(form, "name"),
    company: text(form, "company"),
    email: text(form, "email"),
    phone: text(form, "phone"),
    channel: text(form, "channel"),
    source: text(form, "source"),
    interest: text(form, "interest"),
    destination: text(form, "destination"),
    travel_date: text(form, "travel_date"),
    pax: number(form, "pax"),
    notes: text(form, "notes"),
    duplicate_resolution: form.getAll("duplicate_resolution").includes("mark_duplicate") ? "mark_duplicate" : text(form, "duplicate_resolution"),
  });
}

export async function takeLead(code: string): Promise<LeadActionState> {
  return send(`/crm/leads/${encodeURIComponent(code)}/take`, {});
}

export async function changeLeadStatus(_state: LeadActionState, form: FormData): Promise<LeadActionState> {
  return send(`/crm/leads/${encodeURIComponent(text(form, "code") ?? "")}/status`, { status: text(form, "status"), lock_version: number(form, "lock_version") });
}

export async function qualifyLead(_state: LeadActionState, form: FormData): Promise<LeadActionState> {
  return send(`/crm/leads/${encodeURIComponent(text(form, "code") ?? "")}/qualify`, {
    budget: number(form, "budget") ?? 0,
    authority: number(form, "authority") ?? 0,
    need: number(form, "need") ?? 0,
    timeline: number(form, "timeline") ?? 0,
    amount: number(form, "amount"),
    currency: text(form, "currency") ?? "PEN",
    notes: text(form, "notes"),
    mark_qualified: form.get("mark_qualified") === "on",
    lock_version: number(form, "lock_version"),
  });
}

export async function discardLead(_state: LeadActionState, form: FormData): Promise<LeadActionState> {
  return send(`/crm/leads/${encodeURIComponent(text(form, "code") ?? "")}/discard`, { reason: text(form, "reason"), detail: text(form, "detail"), lock_version: number(form, "lock_version") });
}

export async function convertLead(_state: LeadActionState, form: FormData): Promise<LeadActionState> {
  return send(`/crm/leads/${encodeURIComponent(text(form, "code") ?? "")}/convert`, {
    doc_type: text(form, "doc_type"),
    doc_number: text(form, "doc_number"),
    city: text(form, "city"),
    opportunity_title: text(form, "opportunity_title"),
    amount: number(form, "amount"),
    currency: text(form, "currency") ?? "PEN",
    expected_close_date: text(form, "expected_close_date"),
    lock_version: number(form, "lock_version"),
  });
}
