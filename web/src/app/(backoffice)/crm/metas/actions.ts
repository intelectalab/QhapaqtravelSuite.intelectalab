"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

const GOALS = ["goal_sales", "goal_bookings", "goal_margin", "goal_conversion", "bonus_amount"];

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function refresh(result: StepResult): StepResult {
  if (result.done) revalidatePath("/crm/metas", "layout");
  return result;
}

export async function saveTarget(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = text(form, "code");
  if (code) return refresh(await sendStep(`/crm/sales-targets/${encodeURIComponent(code)}`, "PATCH", formValues(form, [...GOALS, "reason"]), "No pudimos ajustar la meta."));
  const body = { ...formValues(form, ["scope_type", "scope_id", "period", ...GOALS]), activate: form.get("activate") === "on" };
  return refresh(await sendStep("/crm/sales-targets", "POST", body, "No pudimos crear la meta."));
}

export async function targetStep(_state: StepResult, form: FormData): Promise<StepResult> {
  const code = encodeURIComponent(text(form, "code"));
  const step = text(form, "step");
  if (!["activate", "void", "close"].includes(step)) return { message: "Acción no disponible.", done: false };
  return refresh(await sendStep(`/crm/sales-targets/${code}/${step}`, "POST", formValues(form, ["reason", "lock_version"]), "No pudimos actualizar la meta."));
}

interface TeamInput {
  code?: string;
  name: string;
  leader_id: string | null;
  members: string[];
}

export async function saveSalesTeam(_state: StepResult, form: FormData): Promise<StepResult> {
  const current = JSON.parse(text(form, "current") || "[]") as TeamInput[];
  const code = text(form, "code");
  const mode = text(form, "mode");
  const edited: TeamInput = { name: text(form, "name"), leader_id: text(form, "leader_id") || null, members: form.getAll("members").map(String).filter(Boolean) };
  const teams = mode === "delete" ? current.filter((team) => team.code !== code) : code ? current.map((team) => (team.code === code ? { ...edited, code } : team)) : [...current, edited];
  return refresh(await sendStep("/crm/sales-teams", "PUT", { teams }, mode === "delete" ? "No pudimos quitar el equipo." : "No pudimos guardar el equipo."));
}

export async function saveTargetPolicy(_state: StepResult, form: FormData): Promise<StepResult> {
  const tiers = [1, 2, 3, 4, 5]
    .map((index) => ({ min: text(form, `min_${index}`), pay: text(form, `pay_${index}`) }))
    .filter((tier) => tier.min !== "" && tier.pay !== "")
    .map((tier) => ({ min: Number(tier.min), pay: Number(tier.pay) }));
  return refresh(await sendStep("/crm/sales-target-policy", "PUT", { tiers, ...formValues(form, ["lock_decrease_after_pct", "attribution_window_days", "primary_metric"]) }, "No pudimos guardar la política de bonos."));
}
