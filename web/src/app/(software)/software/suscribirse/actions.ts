"use server";

import { apiFetch } from "@/lib/server/api";
import { captchaHeaders } from "@/lib/server/captcha";
import { formValues } from "@/lib/server/resource";
import type { ActionResult, PaymentMethod, SignupCycle, SignupStatus, SignupTotals, Taxpayer } from "@/lib/landing";
import type { DemoFormState } from "@/lib/software";

function failure<T>(result: { error?: { message?: string; code?: string; errors?: Record<string, string[]> } | null }, fallback: string): ActionResult<T> {
  const errors = Object.fromEntries(Object.entries(result.error?.errors ?? {}).map(([field, messages]) => [field, messages[0] ?? ""]));
  return { ok: false, message: result.error?.message ?? fallback, errors, code: result.error?.code };
}

export async function lookupRuc(ruc: string): Promise<ActionResult<Taxpayer>> {
  const clean = ruc.replace(/\D/g, "");
  if (clean.length !== 11) return { ok: false, message: "El RUC tiene 11 dígitos y empieza en 10 o 20." };
  const result = await apiFetch<Taxpayer>(`/public/ruc/${clean}`, { auth: false });
  return result.ok && result.data ? { ok: true, data: result.data } : failure(result, "No pudimos consultar el RUC.");
}

export async function checkCoupon(coupon: string, plan: string, cycle: SignupCycle): Promise<ActionResult<SignupTotals>> {
  const result = await apiFetch<{ totals: SignupTotals }>("/public/coupons/validate", { method: "POST", body: { coupon, plan, cycle }, auth: false });
  return result.ok && result.data ? { ok: true, data: result.data.totals } : failure(result, "No pudimos validar el cupón.");
}

export async function createSignup(form: FormData): Promise<ActionResult<{ token: string; state: string; totals: SignupTotals }>> {
  const body = {
    ...formValues(form, ["plan", "cycle", "admin_name", "email", "password", "phone", "commercial_name", "ruc", "city", "business_type", "doc_type", "coupon", "expected_total"]),
    accept_terms: form.get("accept_terms") === "on",
    marketing_consent: form.get("marketing_consent") === "on",
    terms_version: "TYC-2026.1",
    utm: Object.fromEntries(["source", "medium", "campaign"].map((key) => [key, String(form.get(`utm_${key}`) ?? "").trim() || null]).filter(([, value]) => value !== null)),
    gclid: String(form.get("gclid") ?? "").trim() || null,
    fbclid: String(form.get("fbclid") ?? "").trim() || null,
  };
  const result = await apiFetch<{ token: string; state: string; totals: SignupTotals }>("/public/signups", { method: "POST", body, auth: false, headers: captchaHeaders(form) });
  return result.ok && result.data ? { ok: true, data: result.data } : failure(result, "No pudimos crear tu cuenta. Inténtalo de nuevo.");
}

export async function payCheckout(token: string, method: PaymentMethod, payment: Record<string, string>): Promise<ActionResult<{ state: string; payment?: { qr: string | null; expires_at: string | null; message: string | null } }>> {
  const result = await apiFetch<{ state: string; payment?: { qr: string | null; expires_at: string | null; message: string | null } }>(`/public/signups/${encodeURIComponent(token)}/checkout`, { method: "POST", body: { method, ...payment }, auth: false });
  return result.ok && result.data ? { ok: true, data: result.data } : failure(result, "No pudimos procesar el pago.");
}

export async function signupStatus(token: string): Promise<SignupStatus | null> {
  const result = await apiFetch<SignupStatus>(`/public/signups/${encodeURIComponent(token)}`, { auth: false });
  return result.ok ? result.data : null;
}

const LEAD_FIELDS = ["full_name", "email", "phone", "company", "business_type", "team_size", "intent", "message", "website"];

export async function sendSalesLead(_state: DemoFormState, form: FormData): Promise<DemoFormState> {
  const body = { ...formValues(form, LEAD_FIELDS), source: "formulario", plan: String(form.get("plan") ?? "") || null, consent: form.get("consent") === "on" };
  const result = await apiFetch<{ code: string; repeated: boolean; message: string }>("/public/sales-leads", { method: "POST", body, auth: false });

  if (!result.ok || !result.data) {
    const errors = Object.fromEntries(Object.entries(result.error?.errors ?? {}).map(([field, messages]) => [field, messages[0] ?? ""]));
    return { done: false, code: null, errors, values: Object.fromEntries(LEAD_FIELDS.map((field) => [field, String(form.get(field) ?? "")])), message: Object.keys(errors).length > 0 ? "Revisa los campos marcados." : (result.error?.message ?? "No pudimos enviar tu mensaje.") };
  }

  return { done: true, code: result.data.code, errors: {}, values: {}, message: result.data.message };
}
