"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiFetch } from "@/lib/server/api";
import { confirmMfa, type FormState } from "@/lib/server/auth";

export async function platformVerifyMfa(_state: FormState, form: FormData): Promise<FormState> {
  return confirmMfa("platform", form);
}

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
  const result = await apiFetch(`/platform/tenants/${encodeURIComponent(tenant)}/${mode}`, { method: "POST", body: { reason }, realm: "platform" });
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
