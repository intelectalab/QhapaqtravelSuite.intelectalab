"use server";

import { revalidatePath } from "next/cache";
import { platformSend, type ConsoleResult } from "@/lib/server/platformConsole";

const text = (form: FormData, field: string) => String(form.get(field) ?? "").trim();

const optional = (form: FormData, field: string) => text(form, field) || null;

const invoicePath = (form: FormData, suffix: string) => `/invoices/${encodeURIComponent(text(form, "id"))}${suffix}`;

async function finish(result: Promise<ConsoleResult>): Promise<ConsoleResult> {
  const outcome = await result;
  revalidatePath("/plataforma", "layout");
  return outcome;
}

export async function retryInvoice(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  const outcome = await platformSend<{ result: string; message: string }>(invoicePath(form, "/retry"), "POST", {}, "No pudimos reintentar el cobro.", (data) => data?.message ?? null);
  revalidatePath("/plataforma", "layout");
  if (outcome.done && outcome.notice && outcome.notice !== "Aprobado") return { done: false, message: `El emisor rechazó el cobro: ${outcome.notice}. El intento quedó registrado.` };
  return outcome;
}

export async function registerManualPayment(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return finish(platformSend(invoicePath(form, "/manual-payment"), "POST", { method: text(form, "method"), reference: text(form, "reference"), paid_on: text(form, "paid_on") }, "No pudimos registrar el pago."));
}

export async function voidInvoice(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return finish(platformSend(invoicePath(form, "/void"), "POST", { reason: text(form, "reason") }, "No pudimos anular la factura."));
}

export async function extendDunning(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return finish(platformSend(invoicePath(form, "/dunning/extend"), "POST", {}, "No pudimos dar la prórroga."));
}

export async function suspendForDebt(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return finish(platformSend(invoicePath(form, "/dunning/suspend"), "POST", { reason: text(form, "reason") }, "No pudimos suspender la agencia."));
}

export async function updateDunningPolicy(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  const days = form.getAll("retry_days").map((value) => String(value).trim()).filter(Boolean).map(Number);
  if (days.length === 0) return { done: false, message: "Indica al menos un día de reintento." };
  return finish(platformSend("/dunning-policy", "PATCH", { retry_days: days, suspend_after_last: text(form, "suspend_after_last") === "1" }, "No pudimos guardar la política."));
}

export async function extendTrial(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return finish(platformSend(`/trials/${encodeURIComponent(text(form, "tenant"))}/extend`, "POST", { days: Number(text(form, "days") || 7) }, "No pudimos extender la prueba."));
}

export async function convertTrial(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return finish(platformSend(`/trials/${encodeURIComponent(text(form, "tenant"))}/convert`, "POST", { coupon: optional(form, "coupon"), plan: optional(form, "plan"), cycle: optional(form, "cycle") }, "No pudimos convertir la prueba."));
}

export async function saveCoupon(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  const body = {
    type: text(form, "type"),
    value: Number(text(form, "value")),
    duration_cycles: Number(text(form, "duration_cycles")),
    plans: form.getAll("plans").map(String),
    max_redemptions: optional(form, "max_redemptions") === null ? null : Number(text(form, "max_redemptions")),
    valid_to: optional(form, "valid_to"),
    note: optional(form, "note"),
  };
  const editing = text(form, "original");
  if (editing) return finish(platformSend(`/coupons/${encodeURIComponent(editing)}`, "PATCH", body, "No pudimos guardar el cupón."));
  return finish(platformSend("/coupons", "POST", { ...body, code: text(form, "code") }, "No pudimos crear el cupón."));
}

export async function setCouponStatus(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return finish(platformSend(`/coupons/${encodeURIComponent(text(form, "code"))}/status`, "POST", { active: text(form, "active") === "1" }, "No pudimos cambiar el estado del cupón."));
}

export async function setPlanFeature(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return finish(platformSend(`/features/${encodeURIComponent(text(form, "feature"))}/plans/${encodeURIComponent(text(form, "plan"))}`, "PUT", { value: optional(form, "value") }, "No pudimos actualizar el plan."));
}

export async function saveOverride(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return finish(
    platformSend("/feature-overrides", "POST", { tenant: text(form, "tenant"), feature: text(form, "feature"), value: text(form, "value") !== "0", reason: text(form, "reason"), valid_until: optional(form, "valid_until") }, "No pudimos guardar la excepción."),
  );
}

export async function deleteOverride(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return finish(platformSend(`/feature-overrides/${encodeURIComponent(text(form, "id"))}`, "DELETE", {}, "No pudimos quitar la excepción."));
}

export async function sendPaymentLink(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return finish(platformSend<{ sent_to: string }>(invoicePath(form, "/payment-link"), "POST", {}, "No pudimos enviar el enlace de pago.", (data) => (data ? `Enlace enviado a ${data.sent_to}.` : null)));
}

export async function resendInvoice(_state: ConsoleResult, form: FormData): Promise<ConsoleResult> {
  return finish(platformSend<{ sent_to: string }>(invoicePath(form, "/send"), "POST", {}, "No pudimos reenviar la factura.", (data) => (data ? `Factura reenviada a ${data.sent_to}.` : null)));
}
