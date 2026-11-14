"use server";

import type { AdminActionState } from "@/lib/admin";
import { flag, sendAdmin, text } from "@/lib/server/admin";

const PATH = "/admin/configuracion";

const SWITCHES: Record<string, string[]> = { currency: ["price_with_tax"], operations: ["noshow_notify_advisor", "noshow_incident", "noshow_charge"] };

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

const WEEK_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

export async function updateBusinessHours(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  const days = Object.fromEntries(WEEK_DAYS.map((day) => [day, { open: flag(form, `${day}_open`), from: text(form, `${day}_from`) ?? null, to: text(form, `${day}_to`) ?? null }]));
  return sendAdmin("/settings/business-hours", "PUT", { days, lock_version: text(form, "lock_version") ?? null }, PATH, "No pudimos guardar el horario.");
}

export async function updateSequence(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin("/settings/sequences", "PATCH", { doc_type: text(form, "doc_type"), series: text(form, "series"), prefix: text(form, "prefix")?.toUpperCase(), next_number: text(form, "next_number") }, PATH);
}

export async function createSequence(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin("/settings/sequences", "POST", { doc_type: text(form, "doc_type"), prefix: text(form, "prefix")?.toUpperCase(), next_number: text(form, "next_number"), pad_width: text(form, "pad_width"), year_reset: flag(form, "year_reset") }, PATH, "No pudimos crear la serie.");
}
