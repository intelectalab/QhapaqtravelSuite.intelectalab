"use server";

import { revalidatePath } from "next/cache";
import { apiFetch } from "@/lib/server/api";
import { formValues, type StepResult } from "@/lib/server/resource";

interface GrowthStepConfig {
  path: (key: string) => string;
  method: "POST" | "PUT";
  fields: string[];
  lists?: string[];
  booleans?: string[];
  refresh: string;
  failure: string;
  success?: (data: Record<string, unknown>) => string | null;
}

const STEPS: Record<string, GrowthStepConfig> = {
  link_create: { path: () => "/finance/payment-links", method: "POST", fields: ["receivable_id", "amount", "installments_max", "expires_at"], lists: ["methods"], refresh: "/finanzas/links-de-pago", failure: "No pudimos crear el link de pago.", success: (data) => `Link ${String(data.code)} listo: ${String(data.url)}` },
  link_send: { path: (key) => `/finance/payment-links/${key}/send`, method: "POST", fields: ["via", "to"], refresh: "/finanzas/links-de-pago", failure: "No pudimos enviar el link." },
  link_cancel: { path: (key) => `/finance/payment-links/${key}/cancel`, method: "POST", fields: ["reason", "lock_version"], refresh: "/finanzas/links-de-pago", failure: "No pudimos anular el link." },
  card_issue: { path: () => "/finance/gift-cards", method: "POST", fields: ["amount", "currency", "recipient_name", "recipient_email", "message", "expires_at"], refresh: "/finanzas/vales", failure: "No pudimos emitir el vale.", success: (data) => `Vale ${String(data.code)} emitido. Código de canje: ${String(data.redeem_code)}. Cópialo ahora: no se vuelve a mostrar.` },
  card_redeem: { path: (key) => `/finance/gift-cards/${key}/redeem`, method: "POST", fields: ["redeem_code", "amount", "receivable_id"], refresh: "/finanzas/vales", failure: "No pudimos canjear el vale." },
  card_void: { path: (key) => `/finance/gift-cards/${key}/void`, method: "POST", fields: ["reason", "lock_version"], refresh: "/finanzas/vales", failure: "No pudimos anular el vale." },
  export_create: { path: () => "/finance/accounting-exports", method: "POST", fields: ["target", "period_from", "period_to"], lists: ["scope"], refresh: "/finanzas/exportacion-contable", failure: "No pudimos generar la exportación." },
  waiver_create: { path: () => "/ops/waiver-templates", method: "POST", fields: ["code", "name", "lang", "body"], booleans: ["requires_guardian_for_minors"], refresh: "/operaciones/checkin", failure: "No pudimos guardar el deslinde." },
  checkin_scan: { path: () => "/ops/checkin/scan", method: "POST", fields: ["token", "device_id"], refresh: "/operaciones/checkin", failure: "No pudimos registrar el ingreso." },
  insight_resolve: { path: (key) => `/reports/insights/${key}/resolve`, method: "POST", fields: ["status"], refresh: "/reportes/alertas", failure: "No pudimos actualizar la alerta." },
};

export interface GrowthStepResult extends StepResult {
  notice?: string | null;
}

export async function growthStep(_state: GrowthStepResult, form: FormData): Promise<GrowthStepResult> {
  const step = STEPS[String(form.get("step") ?? "")];
  if (!step) return { message: "Acción no disponible.", done: false };
  const key = encodeURIComponent(String(form.get("key") ?? ""));
  const body: Record<string, unknown> = { ...formValues(form, step.fields) };
  for (const list of step.lists ?? []) body[list] = form.getAll(list).map(String).filter(Boolean);
  for (const flag of step.booleans ?? []) body[flag] = form.get(flag) === "1";
  const result = await apiFetch<Record<string, unknown>>(step.path(key), { method: step.method, body });
  if (!result.ok) {
    const first = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: first ?? result.error?.message ?? step.failure, done: false };
  }
  revalidatePath(step.refresh);
  return { message: null, done: true, notice: step.success && result.data ? step.success(result.data) : null };
}

export async function saveAccountMappings(target: string, mappings: { concept: string; account_code: string; cost_center: string }[]): Promise<GrowthStepResult> {
  const result = await apiFetch("/finance/account-mappings", { method: "PUT", body: { target, mappings } });
  if (!result.ok) {
    const first = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: first ?? result.error?.message ?? "No pudimos guardar el plan de cuentas.", done: false };
  }
  revalidatePath("/finanzas/exportacion-contable");
  return { message: null, done: true };
}

export async function downloadAccountingExport(code: string): Promise<{ name: string; mime: string; content: string } | null> {
  const result = await apiFetch<{ data: { file?: { name: string; mime: string; content_base64: string } }[] }>(`/finance/accounting-exports?filter[code]=${encodeURIComponent(code)}&include=file`, { raw: true });
  const file = result.ok ? result.data?.data[0]?.file : undefined;
  return file ? { name: file.name, mime: file.mime, content: file.content_base64 } : null;
}
