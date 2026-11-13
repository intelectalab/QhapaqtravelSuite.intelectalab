"use server";

import { revalidatePath } from "next/cache";
import { sendStep, type StepResult } from "@/lib/server/resource";

const text = (form: FormData, field: string) => String(form.get(field) ?? "").trim();

const number = (form: FormData, field: string) => Number(text(form, field) || 0);

function terms(form: FormData): Record<string, unknown> {
  const credentials = { client_id: text(form, "client_id"), secret: text(form, "secret") };
  return {
    label: text(form, "label") || null,
    account_ref: text(form, "account_ref"),
    fee_pct: number(form, "fee_pct"),
    fee_fixed: number(form, "fee_fixed"),
    fx_spread_pct: number(form, "fx_spread_pct"),
    tax_on_fee: form.get("tax_on_fee") === "1",
    settle_days: number(form, "settle_days"),
    pass_fee_to_customer: form.get("pass_fee_to_customer") === "1",
    status: text(form, "status") || "pendiente",
    mode: text(form, "mode") || "sandbox",
    ...(credentials.client_id || credentials.secret ? { credentials } : {}),
  };
}

export async function saveGateway(_state: StepResult, form: FormData): Promise<StepResult> {
  const id = text(form, "id");
  const result = id
    ? await sendStep(`/finance/gateways/${encodeURIComponent(id)}`, "PATCH", terms(form), "No pudimos guardar la pasarela.")
    : await sendStep("/finance/gateways", "POST", { ...terms(form), provider: text(form, "provider"), currency: text(form, "currency"), fee_currency: text(form, "fee_currency") || text(form, "currency") }, "No pudimos conectar la pasarela.");
  if (result.done) revalidatePath("/finanzas/pasarelas");
  return result;
}

export async function importSettlement(_state: StepResult, form: FormData): Promise<StepResult> {
  const raw = text(form, "lines");
  const lines = raw
    ? raw.split("\n").map((row) => row.split(/[;,\t]/).map((cell) => cell.trim())).filter((cells) => cells[0]).map(([payment, fee, fee_tax, settled_on, external_ref]) => ({ payment, fee: Number(fee || 0), fee_tax: Number(fee_tax || 0), settled_on: settled_on || null, external_ref: external_ref || null }))
    : undefined;
  const result = await sendStep("/finance/gateway-fees/import", "POST", { gateway: text(form, "gateway"), ...(lines ? { lines } : {}) }, "No pudimos importar la liquidación.");
  if (result.done) revalidatePath("/finanzas/pasarelas");
  return result;
}
