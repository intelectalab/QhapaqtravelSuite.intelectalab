"use server";

import type { AdminActionState } from "@/lib/admin";
import { fields, list, sendAdmin, text } from "@/lib/server/admin";

const PATH = "/admin/reglas";

const rule = (form: FormData) => encodeURIComponent(text(form, "code") ?? "");

export async function toggleRule(code: string, enabled: boolean): Promise<AdminActionState> {
  return sendAdmin(`/admin/rules/${encodeURIComponent(code)}/toggle`, "POST", { enabled }, PATH, "No pudimos cambiar la regla.");
}

export async function updateRuleParams(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  const params: Record<string, unknown> = {};
  form.forEach((value, key) => {
    if (key.startsWith("p_") && typeof value === "string") params[key.slice(2)] = value.trim();
  });
  for (const key of list(form, "bool_keys")) params[key] = form.get(`p_${key}`) === "on";
  return sendAdmin(`/admin/rules/${rule(form)}/params`, "PATCH", { params }, PATH, "No pudimos guardar los parámetros.");
}

export async function resetRule(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/admin/rules/${rule(form)}/reset`, "POST", { reason: text(form, "reason") }, PATH);
}

export async function createRule(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin("/admin/rules", "POST", fields(form, ["name", "description", "group"]), PATH, "No pudimos crear la regla.");
}

export async function updateRule(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/admin/rules/${rule(form)}`, "PATCH", fields(form, ["name", "description", "group"]), PATH);
}

export async function deleteRule(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/admin/rules/${rule(form)}`, "DELETE", {}, PATH, "No pudimos eliminar la regla.");
}
