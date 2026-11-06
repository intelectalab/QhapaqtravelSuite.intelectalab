"use server";

import type { AdminActionState } from "@/lib/admin";
import { flag, sendAdmin, text } from "@/lib/server/admin";

const PATH = "/admin/configuracion";

const SWITCHES: Record<string, string[]> = { currency: ["price_with_tax"] };

export async function updateSettings(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  const section = text(form, "section") ?? "";
  const body: Record<string, unknown> = {};
  form.forEach((value, key) => {
    if (key === "section" || key.startsWith("$") || typeof value !== "string") return;
    body[key] = value.trim() === "" ? null : value.trim();
  });
  for (const key of SWITCHES[section] ?? []) body[key] = flag(form, key);
  return sendAdmin(`/settings/${encodeURIComponent(section)}`, "PATCH", body, PATH);
}

export async function updateSequence(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin("/settings/sequences", "PATCH", { doc_type: text(form, "doc_type"), prefix: text(form, "prefix")?.toUpperCase(), next_number: text(form, "next_number") }, PATH);
}
