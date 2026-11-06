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

export async function createActivity(_state: ActivityState, form: FormData): Promise<ActivityState> {
  const related = value(form, "related");
  const [relatedType, relatedCode] = related ? related.split(":") : [undefined, undefined];
  return send("/crm/activities", {
    type: value(form, "type"),
    subject: value(form, "subject"),
    description: value(form, "description"),
    related_type: relatedType,
    related_code: relatedCode,
    due_at: value(form, "due_at"),
  });
}

export async function completeActivity(_state: ActivityState, form: FormData): Promise<ActivityState> {
  const next = form.get("schedule_next") === "on" ? { type: value(form, "next_type"), subject: value(form, "next_subject"), due_at: value(form, "next_due_at") } : undefined;
  return send(`/crm/activities/${encodeURIComponent(value(form, "code") ?? "")}/complete`, { result: value(form, "result"), next });
}

export async function rescheduleActivity(_state: ActivityState, form: FormData): Promise<ActivityState> {
  return send(`/crm/activities/${encodeURIComponent(value(form, "code") ?? "")}/reschedule`, { due_at: value(form, "due_at") });
}

export async function updateActivity(_state: ActivityState, form: FormData): Promise<ActivityState> {
  return send(`/crm/activities/${encodeURIComponent(value(form, "code") ?? "")}`, { type: value(form, "type"), subject: value(form, "subject"), description: value(form, "description"), owner_id: value(form, "owner_id") }, "PATCH");
}

export async function deleteActivity(_state: ActivityState, form: FormData): Promise<ActivityState> {
  return send(`/crm/activities/${encodeURIComponent(value(form, "code") ?? "")}`, { reason: value(form, "reason") }, "DELETE");
}
