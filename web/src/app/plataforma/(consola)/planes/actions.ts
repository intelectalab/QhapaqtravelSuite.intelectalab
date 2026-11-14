"use server";

import { revalidatePath } from "next/cache";
import type { PlanRuleChange } from "@/lib/platformBilling";
import { apiFetch } from "@/lib/server/api";
import { platformSend, type ConsoleResult } from "@/lib/server/platformConsole";

const text = (form: FormData, field: string) => String(form.get(field) ?? "").trim();

export async function previewPlanRule(rule: string, plan: string): Promise<{ change: PlanRuleChange | null; message: string | null }> {
  const result = await apiFetch<PlanRuleChange>(`/platform/plan-rules/${encodeURIComponent(rule)}?dry_run=1`, { method: "PUT", body: { min_plan: plan }, realm: "platform" });
  if (!result.ok || !result.data) return { change: null, message: result.error?.message ?? "No pudimos calcular el efecto del cambio." };
  return { change: result.data, message: null };
}

export async function applyPlanRule(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  const outcome = await platformSend(`/plan-rules/${encodeURIComponent(text(form, "rule"))}`, "PUT", { min_plan: text(form, "min_plan") }, "No pudimos cambiar el plan mínimo de la regla.");
  revalidatePath("/plataforma", "layout");
  return outcome;
}

export async function decideRuleRequest(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  const outcome = await platformSend(`/rule-requests/${encodeURIComponent(text(form, "code"))}/decision`, "POST", { decision: text(form, "decision"), reason: text(form, "reason") || null, linked_rule: text(form, "linked_rule") || null, lock_version: Number(text(form, "lock_version")) || null }, "No pudimos guardar la decisión.");
  revalidatePath("/plataforma/planes/pedidos");
  return outcome;
}

export async function resetPlanRules(): Promise<ConsoleResult> {
  const outcome = await platformSend("/plan-rules/reset-demo", "POST", {}, "No pudimos restablecer la matriz.");
  revalidatePath("/plataforma", "layout");
  return outcome;
}
