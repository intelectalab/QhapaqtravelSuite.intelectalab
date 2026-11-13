"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiFetch } from "@/lib/server/api";
import { confirmMfa, type FormState } from "@/lib/server/auth";
import type { PlanChangePreview } from "@/lib/admin";
import { TENANT_STEP_FIELDS, type BillingCycle, type PlanEffective, type ProvisionPayload } from "@/lib/platform";
import { stepByField, wizardFailure, type WizardResult } from "@/lib/wizard";

export async function platformVerifyMfa(_state: FormState, form: FormData): Promise<FormState> {
  return confirmMfa("platform", form);
}

const lockVersion = (form: FormData) => String(form.get("lock_version") ?? "").trim() || undefined;

export interface StatusState {
  message: string | null;
  done: boolean;
}

const statusSchema = z.object({
  tenant: z.string().min(1),
  mode: z.enum(["suspend", "reactivate"]),
  reason: z.string().trim().min(5, "Explica el motivo con un poco más de detalle.").max(500, "El motivo es demasiado largo."),
});

export async function changeTenantStatus(_state: StatusState, form: FormData): Promise<StatusState> {
  const parsed = statusSchema.safeParse({ tenant: form.get("tenant"), mode: form.get("mode"), reason: form.get("reason") });
  if (!parsed.success) return { message: parsed.error.issues[0].message, done: false };

  const { tenant, mode, reason } = parsed.data;
  const result = await apiFetch(`/platform/tenants/${encodeURIComponent(tenant)}/${mode}`, { method: "POST", body: { reason, lock_version: lockVersion(form) }, realm: "platform" });
  if (!result.ok) return { message: result.error?.message ?? "No pudimos cambiar el estado de la agencia.", done: false };

  revalidatePath("/plataforma", "layout");
  return { message: null, done: true };
}

const LIMIT_METRICS = ["users", "sedes", "storage_gb", "reservations_month", "whatsapp_month", "email_month", "api_calls_month", "api_rate_per_min", "webhooks", "api_keys"] as const;

const amount = (label: string) => z.coerce.number({ message: `Escribe ${label}.` }).min(0, `${label[0].toUpperCase()}${label.slice(1)} no puede ser negativo.`);

const limitValue = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : Number(value)))
  .refine((value) => value === null || (Number.isInteger(value) && value >= 0), "Los límites son números enteros sin signo.");

const planSchema = z.object({
  code: z.string().min(1),
  price_month: amount("el precio mensual"),
  price_year: amount("el precio anual"),
  trial_days: z.coerce.number().int().min(0).max(60, "La prueba gratis puede durar hasta 60 días."),
  support_level: z.string().trim().max(80),
  limits: z.object(Object.fromEntries(LIMIT_METRICS.map((metric) => [metric, limitValue]))),
});

export async function updatePlan(_state: StatusState, form: FormData): Promise<StatusState> {
  const parsed = planSchema.safeParse({
    code: form.get("code"),
    price_month: form.get("price_month"),
    price_year: form.get("price_year"),
    trial_days: form.get("trial_days"),
    support_level: form.get("support_level") ?? "",
    limits: Object.fromEntries(LIMIT_METRICS.map((metric) => [metric, String(form.get(`limit_${metric}`) ?? "")])),
  });
  if (!parsed.success) return { message: parsed.error.issues[0].message, done: false };

  const { code, ...body } = parsed.data;
  const result = await apiFetch(`/platform/plans/${encodeURIComponent(code)}`, { method: "PUT", body: { ...body, support_level: body.support_level || null }, realm: "platform" });
  if (!result.ok) return { message: result.error?.message ?? "No pudimos guardar el plan.", done: false };

  revalidatePath("/plataforma", "layout");
  return { message: null, done: true };
}

export interface ProvisionState {
  message: string | null;
  done: boolean;
  code?: string;
}

const TENANT_FIELDS = ["commercial_name", "legal_name", "ruc", "fiscal_address", "business_type", "subdomain", "country", "locale", "base_currency", "alt_currency", "timezone"] as const;

async function tenantRequest(path: string, method: "POST" | "PATCH", body: Record<string, unknown>): Promise<ProvisionState> {
  const result = await apiFetch(path, { method, body, realm: "platform" });
  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? "No pudimos guardar el cambio.", done: false };
  }
  revalidatePath("/plataforma", "layout");
  return { message: null, done: true };
}

export async function changeTenantPlan(_state: ProvisionState, form: FormData): Promise<ProvisionState> {
  const tenant = String(form.get("tenant") ?? "");
  const plan = String(form.get("plan") ?? "").trim();
  if (!plan) return { message: "Elige el nuevo plan.", done: false };
  const cycle = String(form.get("cycle") ?? "").trim() || undefined;
  const effective = String(form.get("effective") ?? "").trim() || undefined;
  return tenantRequest(`/platform/tenants/${encodeURIComponent(tenant)}/change-plan`, "POST", { plan, cycle, effective, reason: String(form.get("reason") ?? "").trim() || undefined, lock_version: lockVersion(form) });
}

export async function previewTenantPlan(tenant: string, plan: string, cycle: BillingCycle, effective: PlanEffective): Promise<{ preview: PlanChangePreview | null; message: string | null }> {
  const result = await apiFetch<PlanChangePreview>(`/platform/tenants/${encodeURIComponent(tenant)}/change-plan/preview`, { method: "POST", body: { plan, cycle, effective }, realm: "platform" });
  if (!result.ok || !result.data) return { preview: null, message: result.error?.message ?? "No pudimos calcular el cambio." };
  return { preview: result.data, message: null };
}

export async function voidTenantScheduledPlan(_state: ProvisionState, form: FormData): Promise<ProvisionState> {
  const tenant = String(form.get("tenant") ?? "");
  const result = await apiFetch(`/platform/tenants/${encodeURIComponent(tenant)}/scheduled-change`, { method: "DELETE", realm: "platform" });
  if (!result.ok) return { message: result.error?.message ?? "No pudimos anular el cambio programado.", done: false };
  revalidatePath("/plataforma", "layout");
  return { message: null, done: true };
}

export async function updateTenant(_state: ProvisionState, form: FormData): Promise<ProvisionState> {
  const tenant = String(form.get("tenant") ?? "");
  const body = Object.fromEntries(TENANT_FIELDS.map((field) => [field, String(form.get(field) ?? "").trim()]));
  return tenantRequest(`/platform/tenants/${encodeURIComponent(tenant)}`, "PATCH", { ...body, lock_version: lockVersion(form) });
}

const tenantStepOf = stepByField(TENANT_STEP_FIELDS, 11);

export async function checkTenantStep(payload: ProvisionPayload, step: number): Promise<WizardResult<null>> {
  const result = await apiFetch<{ valid: boolean }>("/platform/tenants/validate-step", { method: "POST", body: { ...payload, step }, realm: "platform" });
  if (!result.ok) return wizardFailure(result, "No pudimos revisar este paso.", tenantStepOf);
  return { ok: true, data: null };
}

export async function provisionTenantWizard(payload: ProvisionPayload): Promise<WizardResult<{ code: string }>> {
  const result = await apiFetch<{ code: string }>("/platform/tenants", { method: "POST", body: payload, realm: "platform" });
  if (!result.ok || !result.data) return wizardFailure(result, "No pudimos crear la agencia.", tenantStepOf);
  revalidatePath("/plataforma", "layout");
  return { ok: true, data: { code: result.data.code } };
}

