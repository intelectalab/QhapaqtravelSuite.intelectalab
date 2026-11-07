"use server";

import type { AdminActionState } from "@/lib/admin";
import { fields, list, sendAdmin, text } from "@/lib/server/admin";

const PATH = "/admin/reglas";

const rule = (form: FormData) => encodeURIComponent(text(form, "code") ?? "");

export async function toggleRule(code: string, enabled: boolean, lockVersion: number): Promise<AdminActionState> {
  return sendAdmin(`/admin/booking-rules/${encodeURIComponent(code)}`, "PATCH", { enabled, lock_version: lockVersion }, PATH, "No pudimos cambiar la regla.");
}

export async function updateRuleParams(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  const params: Record<string, unknown> = {};
  form.forEach((value, key) => {
    if (key.startsWith("p_") && typeof value === "string") params[key.slice(2)] = value.trim();
  });
  for (const key of list(form, "bool_keys")) params[key] = form.get(`p_${key}`) === "on";
  return sendAdmin(`/admin/booking-rules/${rule(form)}`, "PATCH", { params, lock_version: text(form, "lock_version") }, PATH, "No pudimos guardar los parámetros.");
}

export async function resetRule(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin("/admin/booking-rules/reset", "POST", { code: text(form, "code"), reason: text(form, "reason") }, PATH);
}

export async function createRule(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin("/admin/booking-rules", "POST", fields(form, ["name", "description", "group"]), PATH, "No pudimos crear la regla.");
}

export async function updateRule(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/admin/booking-rules/${rule(form)}`, "PATCH", fields(form, ["name", "description", "group", "lock_version"]), PATH);
}

export async function deleteRule(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/admin/booking-rules/${rule(form)}`, "DELETE", fields(form, ["lock_version"]), PATH, "No pudimos eliminar la regla.");
}
