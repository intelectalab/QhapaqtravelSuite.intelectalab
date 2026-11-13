"use server";

import { randomUUID } from "node:crypto";
import { sendSite } from "@/lib/server/site";

export interface PublicStepResult {
  message: string | null;
  done: boolean;
  data?: Record<string, string | null> | null;
}

function failure(result: { error: { message: string; errors?: Record<string, string[]> } | null }, fallback: string): PublicStepResult {
  const first = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
  return { message: first ?? result.error?.message ?? fallback, done: false };
}

export async function payLink(agencia: string, token: string, _state: PublicStepResult, form: FormData): Promise<PublicStepResult> {
  const method = String(form.get("method") ?? "");
  const body: Record<string, unknown> = { method, email: String(form.get("email") ?? "").trim() || null };
  if (method === "card") {
    body.card_token = String(form.get("card_token") ?? "");
    body.installments = Number(form.get("installments") ?? 1) || 1;
  }
  const result = await sendSite<Record<string, string | null>>(agencia, `/pay/${encodeURIComponent(token)}/checkout`, body, { "Idempotency-Key": randomUUID() });
  if (!result.ok) return failure(result, "No pudimos procesar el pago.");
  return { message: null, done: true, data: result.data };
}

export async function buyGiftCard(agencia: string, _state: PublicStepResult, form: FormData): Promise<PublicStepResult> {
  const body = Object.fromEntries(["amount", "currency", "buyer_name", "buyer_email", "recipient_name", "recipient_email", "message", "card_token"].map((field) => [field, String(form.get(field) ?? "").trim() || null]));
  const result = await sendSite<Record<string, string | null>>(agencia, "/gift-cards", body, { "Idempotency-Key": randomUUID() });
  if (!result.ok) return failure(result, "No pudimos completar la compra.");
  return { message: null, done: true, data: result.data };
}

export async function giftCardBalance(agencia: string, _state: PublicStepResult, form: FormData): Promise<PublicStepResult> {
  const result = await sendSite<Record<string, string | null>>(agencia, "/gift-cards/balance", { redeem_code: String(form.get("redeem_code") ?? "").trim() });
  if (!result.ok) return failure(result, "No pudimos consultar el vale.");
  return { message: null, done: true, data: result.data };
}
