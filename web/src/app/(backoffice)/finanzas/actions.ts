"use server";

import { revalidatePath } from "next/cache";
import type { InvoiceCheck, InvoiceDraft, LineCandidate } from "@/lib/finance";
import { apiFetch } from "@/lib/server/api";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

interface FinanceStepConfig {
  path: (key: string) => string;
  method: "POST" | "PATCH" | "PUT" | "DELETE";
  fields: string[];
  keyField?: string;
  collect?: string;
  json?: string[];
  booleans?: string[];
  failure: string;
}

const parsed = (form: FormData, names: string[] = [], booleans: string[] = []) =>
  Object.fromEntries([
    ...names.map((name) => {
      try {
        return [name, JSON.parse(String(form.get(name) ?? "null"))];
      } catch {
        return [name, null];
      }
    }),
    ...booleans.filter((name) => form.has(name)).map((name) => [name, form.get(name) === "1"]),
  ]);

const collected = (form: FormData, name: string) =>
  Object.fromEntries(
    [...form.entries()]
      .filter(([key, value]) => key.startsWith(`${name}[`) && typeof value === "string" && value.trim() !== "")
      .map(([key, value]) => [key.slice(name.length + 1, -1), Number(value)]),
  );

const STEPS: Record<string, FinanceStepConfig> = {
  receivable_payment: { path: () => "/finance/payments", method: "POST", fields: ["method", "amount", "paid_on", "reference", "fx_rate", "note"], keyField: "receivable_id", failure: "No pudimos registrar el pago." },
  receivable_payment_pick: { path: () => "/finance/payments", method: "POST", fields: ["receivable_id", "method", "amount", "paid_on", "reference", "fx_rate", "note"], failure: "No pudimos registrar el pago." },
  receivable_advance: { path: () => "/finance/receivables/advances", method: "POST", fields: ["reservation", "pct", "amount", "due_date", "concept"], booleans: ["notify"], failure: "No pudimos solicitar el anticipo." },
  receivable_remind: { path: (key) => `/finance/receivables/${key}/reminders`, method: "POST", fields: [], failure: "No pudimos enviar el recordatorio." },
  receivable_cancel: { path: (key) => `/finance/receivables/${key}/cancel`, method: "POST", fields: ["reason"], failure: "No pudimos anular la cuota." },
  payment_confirm: { path: (key) => `/finance/payments/${key}/confirm`, method: "POST", fields: ["receivable"], failure: "No pudimos validar el pago." },
  payment_reject: { path: (key) => `/finance/payments/${key}/reject`, method: "POST", fields: ["reason", "lock_version"], failure: "No pudimos rechazar el pago." },
  payment_retry: { path: (key) => `/finance/payments/${key}/retry`, method: "POST", fields: ["note", "lock_version"], failure: "No pudimos reintentar la validación." },
  payment_revert: { path: (key) => `/finance/payments/${key}/revert`, method: "POST", fields: ["reason", "lock_version"], failure: "No pudimos revertir el pago." },
  payable_create: { path: () => "/finance/payables", method: "POST", fields: ["reservation", "provider", "cost_type", "concept", "amount", "currency", "fx_rate", "due_date", "supplier_doc", "evidence"], failure: "No pudimos registrar el costo." },
  payable_update: { path: (key) => `/finance/payables/${key}`, method: "PATCH", fields: ["reservation", "provider", "cost_type", "currency", "fx_rate", "concept", "amount", "due_date", "supplier_doc", "evidence", "lock_version"], failure: "No pudimos guardar los cambios." },
  payable_schedule: { path: (key) => `/finance/payables/${key}/schedule`, method: "POST", fields: ["scheduled_date", "bank_account", "lock_version"], failure: "No pudimos programar el pago." },
  payable_approve: { path: (key) => `/finance/payables/${key}/approve`, method: "POST", fields: ["lock_version"], failure: "No pudimos aprobar la obligación." },
  payable_pay: { path: (key) => `/finance/payables/${key}/payouts`, method: "POST", fields: ["method", "bank_account", "amount", "paid_on", "operation_ref", "fx_rate", "lock_version"], failure: "No pudimos registrar el pago al proveedor." },
  payable_cancel: { path: (key) => `/finance/payables/${key}/cancel`, method: "POST", fields: ["reason"], failure: "No pudimos anular la obligación." },
  commission_calculate: { path: () => "/finance/commissions/calculate", method: "POST", fields: [], failure: "No pudimos calcular las comisiones." },
  commission_approve: { path: (key) => `/finance/commissions/${key}/approve`, method: "POST", fields: ["lock_version"], failure: "No pudimos aprobar la comisión." },
  commission_pay: { path: (key) => `/finance/commissions/${key}/pay`, method: "POST", fields: ["method", "reference", "lock_version"], failure: "No pudimos registrar el pago de la comisión." },
  commission_recalculate: { path: (key) => `/finance/commissions/${key}/recalculate`, method: "POST", fields: ["lock_version"], failure: "No pudimos recalcular la comisión." },
  rule_create: { path: () => "/finance/commission-rules", method: "POST", fields: ["condition", "pct", "base_type", "valid_from", "valid_to"], failure: "No pudimos crear la regla." },
  rule_update: { path: (key) => `/finance/commission-rules/${key}`, method: "PATCH", fields: ["condition", "pct", "base_type", "valid_from", "valid_to", "lock_version"], booleans: ["active"], failure: "No pudimos guardar la regla." },
  commission_annul: { path: (key) => `/finance/commissions/${key}/annul`, method: "POST", fields: ["reason"], failure: "No pudimos anular la comisión." },
  invoice_issue: { path: () => "/finance/invoices", method: "POST", fields: ["receivable_id", "doc_type", "customer_doc_type", "customer_doc_number", "customer_name", "customer_address", "domiciled", "amount", "fx_rate", "description"], failure: "No pudimos emitir el comprobante." },
  invoice_credit: { path: () => "/finance/invoices", method: "POST", fields: ["doc_type", "ref_invoice_id", "credit_note_reason_code", "amount", "credit_note_reason"], failure: "No pudimos emitir la nota de crédito." },
  invoice_status: { path: (key) => `/finance/invoices/${key}/status-check`, method: "POST", fields: [], failure: "No pudimos consultar al OSE." },
  invoice_deliver: { path: (key) => `/finance/invoices/${key}/deliver`, method: "POST", fields: ["email"], failure: "No pudimos entregar el comprobante." },
  invoice_resend: { path: (key) => `/finance/invoices/${key}/resend`, method: "POST", fields: ["description", "fx_rate", "lock_version"], failure: "No pudimos reenviar el comprobante." },
  movement_create: { path: () => "/treasury/movements", method: "POST", fields: ["account", "direction", "amount", "date", "category", "description", "reference", "counterparty"], failure: "No pudimos registrar el movimiento." },
  treasury_settings: { path: () => "/treasury/settings", method: "PATCH", fields: ["petty_tolerance", "max_petty_expense", "sworn_statement_max", "replenish_threshold_pct", "gateway_fee_pct", "cash_deposit_hours", "margin_target_pct", "margin_floor_pct", "lock_version"], json: ["recurring_outflows", "payment_routing"], failure: "No pudimos guardar la configuración." },
  treasury_sync: { path: () => "/treasury/sync", method: "POST", fields: [], failure: "No pudimos sincronizar la tesorería." },
  fx_revalue: { path: () => "/treasury/fx/revaluations", method: "POST", fields: ["close_rate"], failure: "No pudimos registrar la diferencia cambiaria." },
  period_check: { path: (key) => `/finance/period-closes/${key.replace("%3A", "/checks/")}`, method: "PUT", fields: [], failure: "No pudimos marcar el control." },
  period_uncheck: { path: (key) => `/finance/period-closes/${key.replace("%3A", "/checks/")}`, method: "DELETE", fields: [], failure: "No pudimos desmarcar el control." },
  period_close: { path: (key) => `/finance/period-closes/${key}/close`, method: "POST", fields: [], failure: "No pudimos cerrar el periodo." },
  movement_void: { path: (key) => `/treasury/movements/${key}/void`, method: "POST", fields: ["reason"], failure: "No pudimos anular el movimiento." },
  account_create: { path: () => "/treasury/accounts", method: "POST", fields: ["kind", "name", "currency", "bank", "account_number", "cci", "sede_id", "fund_amount", "custodian_id", "settle_to", "opening_balance", "opening_date"], failure: "No pudimos crear la cuenta." },
  account_update: { path: (key) => `/treasury/accounts/${key}`, method: "PATCH", fields: ["name", "bank", "account_number", "cci", "sede_id", "fund_amount", "custodian_id", "settle_to", "active"], failure: "No pudimos guardar la cuenta." },
  transfer_create: { path: () => "/treasury/transfers", method: "POST", fields: ["from", "to", "amount", "deal_rate", "date", "reference", "description"], failure: "No pudimos registrar la transferencia." },
  gateway_settle: { path: (key) => `/treasury/gateway/${key}/settlements`, method: "POST", fields: ["gross", "fee_pct", "date", "batch"], failure: "No pudimos liquidar la pasarela." },
  session_open: { path: (key) => `/treasury/petty-cash/${key}/sessions`, method: "POST", fields: ["counted", "note"], failure: "No pudimos abrir la caja." },
  expense_create: { path: (key) => `/treasury/petty-cash/${key}/expenses`, method: "POST", fields: ["amount", "date", "category", "description", "receipt_type", "series_number", "issuer_ruc", "supplier", "reservation"], failure: "No pudimos registrar el gasto." },
  count_create: { path: (key) => `/treasury/petty-cash/${key}/counts`, method: "POST", fields: ["kind", "note", "witness_id", "declaration"], collect: "denominations", failure: "No pudimos registrar el arqueo." },
  count_approve: { path: (key) => `/treasury/counts/${key}/approve`, method: "POST", fields: ["note"], failure: "No pudimos aprobar la diferencia." },
  count_validate: { path: (key) => `/treasury/counts/${key}/validate`, method: "POST", fields: [], failure: "No pudimos dar el visto bueno." },
  replenishment_request: { path: (key) => `/treasury/petty-cash/${key}/replenishments`, method: "POST", fields: ["amount", "note"], failure: "No pudimos solicitar la reposición." },
  replenishment_approve: { path: (key) => `/treasury/replenishments/${key}/approve`, method: "POST", fields: ["note"], failure: "No pudimos aprobar la reposición." },
  replenishment_reject: { path: (key) => `/treasury/replenishments/${key}/reject`, method: "POST", fields: ["reason"], failure: "No pudimos rechazar la reposición." },
  settlement_close: { path: (key) => `/finance/reservations/${key}/settlement`, method: "POST", fields: [], failure: "No pudimos cerrar la liquidación." },
  replenishment_pay: { path: (key) => `/treasury/replenishments/${key}/pay`, method: "POST", fields: ["from", "date", "reference"], failure: "No pudimos pagar la reposición." },
  line_confirm: { path: (key) => `/finance/bank-lines/${key}/confirm`, method: "POST", fields: [], failure: "No pudimos confirmar la coincidencia." },
  line_reject: { path: (key) => `/finance/bank-lines/${key}/reject`, method: "POST", fields: [], failure: "No pudimos rechazar la coincidencia." },
  line_resolve: { path: (key) => `/finance/bank-lines/${key}/resolve`, method: "POST", fields: ["resolution", "target", "note"], failure: "No pudimos resolver la línea." },
  reconciliation_matching: { path: () => "/finance/reconciliation/matching", method: "POST", fields: [], failure: "No pudimos ejecutar el matching." },
  reconciliation_close: { path: () => "/finance/reconciliation/closures", method: "POST", fields: [], failure: "No pudimos cerrar la conciliación." },
};

export async function financeStep(_state: StepResult, form: FormData): Promise<StepResult> {
  const step = STEPS[String(form.get("step") ?? "")];
  if (!step) return { message: "Acción no disponible.", done: false };
  const raw = String(form.get("key") ?? "");
  const key = encodeURIComponent(raw);
  const base = step.keyField ? { ...formValues(form, step.fields), [step.keyField]: raw } : formValues(form, step.fields);
  const body = { ...(step.collect ? { ...base, [step.collect]: collected(form, step.collect) } : base), ...parsed(form, step.json, step.booleans) };
  const result = await sendStep(step.path(key), step.method, body, step.failure);
  if (result.done) revalidatePath("/finanzas", "layout");
  return result;
}

const MAX_STATEMENT_BYTES = 2 * 1024 * 1024;

const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

const EXPENSE_FIELDS = ["amount", "date", "category", "description", "receipt_type", "series_number", "issuer_ruc", "supplier", "reservation"];

export async function recordExpense(_state: StepResult, form: FormData): Promise<StepResult> {
  const account = String(form.get("key") || form.get("account") || "");
  const file = form.get("file");
  const payload = new FormData();
  for (const field of EXPENSE_FIELDS) {
    const value = String(form.get(field) ?? "").trim();
    if (value !== "") payload.set(field, value);
  }
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_RECEIPT_BYTES) return { message: "El comprobante supera los 10 MB.", done: false };
    payload.set("file", file, file.name);
  }
  const result = await apiFetch(`/treasury/petty-cash/${encodeURIComponent(account)}/expenses`, { method: "POST", form: payload });
  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? "No pudimos registrar el gasto.", done: false };
  }
  revalidatePath("/finanzas", "layout");
  return { message: null, done: true };
}

export async function importStatement(_state: StepResult, form: FormData): Promise<StepResult> {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { message: "Adjunta el extracto en CSV, TXT o XLSX.", done: false };
  if (file.size > MAX_STATEMENT_BYTES) return { message: "El extracto supera los 2 MB. Divídelo por periodos.", done: false };
  const payload = new FormData();
  for (const field of ["bank", "bank_account"]) {
    const value = String(form.get(field) ?? "").trim();
    if (value !== "") payload.set(field, value);
  }
  payload.set("file", file, file.name);
  const result = await apiFetch("/finance/bank-statements", { method: "POST", form: payload });
  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? "No pudimos importar el extracto.", done: false };
  }
  revalidatePath("/finanzas", "layout");
  return { message: null, done: true };
}

export async function loadLineCandidates(code: string): Promise<{ rows: LineCandidate[]; message: string | null }> {
  const result = await apiFetch<LineCandidate[]>(`/finance/bank-lines/${encodeURIComponent(code)}/candidates`);
  return result.ok ? { rows: result.data ?? [], message: null } : { rows: [], message: result.error?.message ?? "No pudimos cargar los candidatos." };
}

export async function loadInvoiceDraft(code: string): Promise<{ draft: InvoiceDraft | null; message: string | null }> {
  const result = await apiFetch<InvoiceDraft>(`/finance/receivables/${encodeURIComponent(code)}/invoice-draft`);
  return result.ok ? { draft: result.data, message: null } : { draft: null, message: result.error?.message ?? "No pudimos preparar el comprobante." };
}

export async function checkInvoice(payload: Record<string, unknown>): Promise<InvoiceCheck | null> {
  const result = await apiFetch<InvoiceCheck>("/finance/invoices/validate", { method: "POST", body: payload });
  return result.ok ? result.data : null;
}
