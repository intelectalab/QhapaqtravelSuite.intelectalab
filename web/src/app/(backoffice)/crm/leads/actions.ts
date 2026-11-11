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

async function send(path: string, body: Record<string, unknown>, method: "POST" | "PATCH" = "POST"): Promise<LeadActionState> {
  const result = await apiFetch<LeadActionState["result"]>(path, { method, body });
  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    const matches = result.error?.details?.matches as DuplicateMatch[] | undefined;
    return { message: firstError ?? result.error?.message ?? "No pudimos guardar el cambio.", done: false, matches };
  }
  revalidatePath("/crm/leads", "layout");
  revalidatePath("/dashboard");
  return { message: null, done: true, result: result.data ?? undefined };
}

const leadBody = (form: FormData) => ({
  name: text(form, "name"),
  company: text(form, "company"),
  email: text(form, "email"),
  phone: text(form, "phone"),
  channel: text(form, "channel"),
  source: text(form, "source"),
  interest: text(form, "interest"),
  destination: text(form, "destination"),
  destination_id: text(form, "destination_id"),
  product_id: text(form, "product_id"),
  owner_id: text(form, "owner_id"),
  travel_date: text(form, "travel_date"),
  pax: number(form, "pax"),
  notes: text(form, "notes"),
});

const resolution = (form: FormData) => {
  const chosen = form.getAll("duplicate_resolution");
  return chosen.includes("merge") ? "merge" : chosen.includes("mark_duplicate") ? "mark_duplicate" : text(form, "duplicate_resolution");
};

export async function createLead(_state: LeadActionState, form: FormData): Promise<LeadActionState> {
  const chosen = resolution(form);
  return send("/crm/leads", { ...leadBody(form), duplicate_resolution: chosen, merge_into: chosen === "merge" ? text(form, "merge_into") : undefined });
}

export async function createLeadFromConversation(_state: LeadActionState, form: FormData): Promise<LeadActionState> {
  const state = await send(`/inbox/conversations/${encodeURIComponent(text(form, "conversation") ?? "")}/lead`, { ...leadBody(form), duplicate_resolution: resolution(form), lock_version: number(form, "lock_version") });
  if (state.done) revalidatePath("/inbox", "layout");
  return state;
}

export async function takeLead(code: string): Promise<LeadActionState> {
  return send(`/crm/leads/${encodeURIComponent(code)}/take`, {});
}

export async function changeLeadStatus(_state: LeadActionState, form: FormData): Promise<LeadActionState> {
  return send(`/crm/leads/${encodeURIComponent(text(form, "code") ?? "")}/status`, { status: text(form, "status"), note: text(form, "note"), lock_version: number(form, "lock_version") });
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
  const existing = text(form, "client_mode") === "existing";
  return send(`/crm/leads/${encodeURIComponent(text(form, "code") ?? "")}/convert`, {
    client_mode: existing ? "existing" : "new",
    client_code: existing ? text(form, "client_code") : undefined,
    kind: existing ? undefined : text(form, "kind"),
    name: existing ? undefined : text(form, "client_name"),
    segment: existing ? undefined : text(form, "segment"),
    doc_type: existing ? undefined : text(form, "doc_type"),
    doc_number: existing ? undefined : text(form, "doc_number"),
    city: existing ? undefined : text(form, "city"),
    country: existing ? undefined : text(form, "country"),
    opportunity_title: text(form, "opportunity_title"),
    stage: text(form, "stage"),
    owner_id: text(form, "owner_id"),
    amount: number(form, "amount"),
    currency: text(form, "currency") ?? "PEN",
    expected_close_date: text(form, "expected_close_date"),
    schedule_discovery_meeting: form.get("schedule_discovery_meeting") === "on",
    lock_version: number(form, "lock_version"),
  });
}

export async function updateLead(_state: LeadActionState, form: FormData): Promise<LeadActionState> {
  return send(
    `/crm/leads/${encodeURIComponent(text(form, "code") ?? "")}`,
    { ...leadBody(form), lock_version: number(form, "lock_version") },
    "PATCH",
  );
}

export async function assignLead(_state: LeadActionState, form: FormData): Promise<LeadActionState> {
  return send(`/crm/leads/${encodeURIComponent(text(form, "code") ?? "")}/assign`, {
    owner_id: text(form, "owner_id"),
    schedule_first_contact: form.get("schedule_first_contact") === "on",
    reason: text(form, "reason"),
    lock_version: number(form, "lock_version"),
  });
}

export async function reopenLead(_state: LeadActionState, form: FormData): Promise<LeadActionState> {
  return send(`/crm/leads/${encodeURIComponent(text(form, "code") ?? "")}/reopen`, { lock_version: number(form, "lock_version") });
}

export async function markLeadDuplicate(_state: LeadActionState, form: FormData): Promise<LeadActionState> {
  return send(`/crm/leads/${encodeURIComponent(text(form, "code") ?? "")}/mark-duplicate`, {
    duplicate_of_type: text(form, "duplicate_of_type"),
    duplicate_of_id: text(form, "duplicate_of_id"),
    lock_version: number(form, "lock_version"),
  });
}

export async function mergeLead(_state: LeadActionState, form: FormData): Promise<LeadActionState> {
  return send(`/crm/leads/${encodeURIComponent(text(form, "code") ?? "")}/merge`, { source_lead_id: text(form, "source_lead_id") });
}
