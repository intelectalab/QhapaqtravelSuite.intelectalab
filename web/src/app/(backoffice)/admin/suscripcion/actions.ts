"use server";

import type { AdminActionState, PlanChangePreview } from "@/lib/admin";
import { fields, list, sendAdmin, text } from "@/lib/server/admin";
import { apiFetch } from "@/lib/server/api";

const PATH = "/admin/suscripcion";

export async function updateBilling(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin("/billing/subscription", "PATCH", fields(form, ["ruc", "name", "address", "ubigeo", "email", "contact", "doc_type"]), PATH, "No pudimos guardar los datos de facturación.");
}

export async function previewPlanChange(plan: string, cycle: string): Promise<{ preview: PlanChangePreview | null; message: string | null }> {
  const result = await apiFetch<PlanChangePreview>("/billing/subscription/preview-change", { method: "POST", body: { plan, cycle } });
  return result.ok && result.data ? { preview: result.data, message: null } : { preview: null, message: result.error?.message ?? "No pudimos calcular el cambio." };
}

export async function changePlan(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin("/billing/subscription/change", "POST", fields(form, ["plan", "cycle"]), PATH, "No pudimos cambiar el plan.");
}

export async function voidScheduledChange(): Promise<AdminActionState> {
  return sendAdmin("/billing/subscription/scheduled-change", "DELETE", {}, PATH, "No pudimos anular el cambio programado.");
}

export async function cancelSubscription(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  const score = text(form, "score");
  return sendAdmin(
    "/billing/subscription/cancel",
    "POST",
    { ...fields(form, ["reason", "solution", "stay", "comments"]), score: score === undefined ? undefined : Number(score), export: form.get("export") === "on", accept: form.get("accept") === "on" },
    PATH,
    "No pudimos programar la cancelación.",
  );
}

export async function resumeSubscription(): Promise<AdminActionState> {
  return sendAdmin("/billing/subscription/resume", "POST", {}, PATH, "No pudimos reanudar la suscripción.");
}

export async function setAutoRenew(enabled: boolean): Promise<AdminActionState> {
  return sendAdmin("/billing/subscription", "PATCH", { auto_renew: enabled }, PATH, "No pudimos cambiar la renovación automática.");
}

export async function addAddon(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  const quantity = text(form, "quantity");
  return sendAdmin(`/billing/addons/${text(form, "code")}`, "POST", { quantity: quantity === undefined ? undefined : Number(quantity), domain: text(form, "domain") }, PATH, "No pudimos contratar el complemento.");
}

export async function updateAddon(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/billing/addons/${text(form, "code")}`, "PATCH", { quantity: Number(text(form, "quantity") ?? 0) }, PATH, "No pudimos ajustar el complemento.");
}

export async function removeAddon(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/billing/addons/${text(form, "code")}`, "DELETE", {}, PATH, "No pudimos programar el retiro.");
}

export async function redeemCoupon(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin("/billing/coupon", "POST", fields(form, ["code"]), PATH, "No pudimos aplicar el cupón.");
}

export async function payInvoice(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  const numbers = list(form, "number");
  if (numbers.length === 0) return { message: "Elige la factura que quieres pagar.", done: false };
  let paid = 0;
  for (const number of numbers) {
    const result = await sendAdmin(`/billing/invoices/${number}/pay`, "POST", {}, PATH, "No pudimos cobrar la factura.");
    if (!result.done) return paid === 0 ? result : { ...result, message: `Pagamos ${paid} de ${numbers.length} facturas. ${number}: ${result.message ?? "no se pudo cobrar."}` };
    paid += 1;
  }
  return { message: null, done: true };
}

export async function openCardSession(): Promise<{ session: string | null; message: string | null }> {
  const result = await apiFetch<{ session: string }>("/billing/payment-methods/setup-intent", { method: "POST", body: {} });
  return result.ok && result.data ? { session: result.data.session, message: null } : { session: null, message: result.error?.message ?? "No pudimos abrir la pasarela." };
}

export async function saveCard(card: { session: string; token: string; brand: string; last4: string; exp_month: number; exp_year: number; holder: string }): Promise<AdminActionState> {
  return sendAdmin("/billing/payment-methods/default", "PUT", card, PATH, "No pudimos guardar la tarjeta.");
}

export async function sendInvoice(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return sendAdmin(`/billing/invoices/${text(form, "number")}/send`, "POST", {}, PATH, "No pudimos reenviar la factura.");
}
