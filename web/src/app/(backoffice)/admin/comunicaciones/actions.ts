"use server";

import type { AdminActionState } from "@/lib/admin";
import { fields, flag, list, sendAdmin, text } from "@/lib/server/admin";

const PATH = "/admin/comunicaciones";

const body = (form: FormData) => ({
  ...fields(form, ["name", "event", "offset_hours", "subject", "body", "lang", "requires_rule"]),
  channels: list(form, "channels"),
  only_if_balance: flag(form, "only_if_balance"),
  only_if_missing_docs: flag(form, "only_if_missing_docs"),
});

const code = (form: FormData) => encodeURIComponent(text(form, "code") ?? "");

export async function createPaxTemplate(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin("/admin/pax-templates", "POST", body(form), PATH, "No pudimos crear la plantilla.");
}

export async function updatePaxTemplate(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/admin/pax-templates/${code(form)}`, "PATCH", body(form), PATH, "No pudimos guardar la plantilla.");
}

export async function togglePaxTemplate(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/admin/pax-templates/${code(form)}/toggle`, "POST", {}, PATH);
}

export async function deletePaxTemplate(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/admin/pax-templates/${code(form)}`, "DELETE", {}, PATH, "No pudimos eliminar la plantilla.");
}
