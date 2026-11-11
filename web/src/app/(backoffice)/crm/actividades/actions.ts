"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";

export interface ActivityState {
  message: string | null;
  done: boolean;
}

const value = (form: FormData, key: string) => {
  const raw = form.get(key);
  return typeof raw === "string" && raw.trim() !== "" ? raw.trim() : undefined;
};

async function send(path: string, body: Record<string, unknown>, method: "POST" | "PATCH" | "DELETE" = "POST"): Promise<ActivityState> {
  const result = await apiFetch(path, { method, body });
  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? "No pudimos guardar la actividad.", done: false };
  }
  revalidatePath("/crm", "layout");
  revalidatePath("/dashboard");
  return { message: null, done: true };
}

const number = (form: FormData, key: string) => {
  const raw = value(form, key);
  return raw === undefined ? undefined : Number(raw);
};

const relation = (form: FormData) => {
  const related = value(form, "related");
  const [type, code] = related ? related.split(":") : [null, null];
  return { related_type: type, related_code: code };
};

const activityBody = (form: FormData) => ({
  type: value(form, "type"),
  subject: value(form, "subject"),
  description: value(form, "description"),
  owner_id: value(form, "owner_id"),
  due_at: value(form, "due_at"),
});

export async function createActivity(_state: ActivityState, form: FormData): Promise<ActivityState> {
  const { related_type, related_code } = relation(form);
  return send("/crm/activities", { ...activityBody(form), related_type: related_type ?? undefined, related_code: related_code ?? undefined });
}

export async function createConversationActivity(_state: ActivityState, form: FormData): Promise<ActivityState> {
  const state = await send(`/inbox/conversations/${encodeURIComponent(value(form, "conversation") ?? "")}/activities`, activityBody(form));
  if (state.done) revalidatePath("/inbox", "layout");
  return state;
}

export async function completeActivity(_state: ActivityState, form: FormData): Promise<ActivityState> {
  const next = form.get("schedule_next") === "on" ? { type: value(form, "next_type"), subject: value(form, "next_subject"), due_at: value(form, "next_due_at") } : undefined;
  return send(`/crm/activities/${encodeURIComponent(value(form, "code") ?? "")}/complete`, { result: value(form, "result"), next });
}

export async function rescheduleActivity(_state: ActivityState, form: FormData): Promise<ActivityState> {
  return send(`/crm/activities/${encodeURIComponent(value(form, "code") ?? "")}/reschedule`, { due_at: value(form, "due_at"), reason: value(form, "reason"), lock_version: number(form, "lock_version") });
}

export async function updateActivity(_state: ActivityState, form: FormData): Promise<ActivityState> {
  return send(`/crm/activities/${encodeURIComponent(value(form, "code") ?? "")}`, { ...activityBody(form), ...relation(form), lock_version: number(form, "lock_version") }, "PATCH");
}

export async function reassignActivity(_state: ActivityState, form: FormData): Promise<ActivityState> {
  return send(`/crm/activities/${encodeURIComponent(value(form, "code") ?? "")}/reassign`, { owner_id: value(form, "owner_id"), note: value(form, "note"), lock_version: number(form, "lock_version") });
}

export async function deleteActivity(_state: ActivityState, form: FormData): Promise<ActivityState> {
  return send(`/crm/activities/${encodeURIComponent(value(form, "code") ?? "")}`, { reason: value(form, "reason") }, "DELETE");
}
