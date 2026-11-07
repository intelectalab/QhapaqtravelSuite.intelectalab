"use server";

import { revalidatePath } from "next/cache";
import type { InvoiceCheck, InvoiceDraft } from "@/lib/finance";
import { apiFetch } from "@/lib/server/api";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

interface FinanceStepConfig {
  path: (key: string) => string;
  method: "POST" | "PATCH";
  fields: string[];
  keyField?: string;
  failure: string;
}

const STEPS: Record<string, FinanceStepConfig> = {
  receivable_payment: { path: () => "/finance/payments", method: "POST", fields: ["method", "amount", "paid_on", "reference", "fx_rate", "note"], keyField: "receivable_id", failure: "No pudimos registrar el pago." },
  receivable_cancel: { path: (key) => `/finance/receivables/${key}/cancel`, method: "POST", fields: ["reason"], failure: "No pudimos anular la cuota." },
  payment_confirm: { path: (key) => `/finance/payments/${key}/confirm`, method: "POST", fields: ["receivable"], failure: "No pudimos validar el pago." },
  payment_reject: { path: (key) => `/finance/payments/${key}/reject`, method: "POST", fields: ["reason", "lock_version"], failure: "No pudimos rechazar el pago." },
  payment_revert: { path: (key) => `/finance/payments/${key}/revert`, method: "POST", fields: ["reason", "lock_version"], failure: "No pudimos revertir el pago." },
  payable_create: { path: () => "/finance/payables", method: "POST", fields: ["reservation", "provider", "cost_type", "concept", "amount", "currency", "fx_rate", "due_date", "supplier_doc", "evidence"], failure: "No pudimos registrar el costo." },
  payable_update: { path: (key) => `/finance/payables/${key}`, method: "PATCH", fields: ["concept", "amount", "due_date", "supplier_doc", "evidence"], failure: "No pudimos guardar los cambios." },
  payable_approve: { path: (key) => `/finance/payables/${key}/approve`, method: "POST", fields: ["lock_version"], failure: "No pudimos aprobar la obligación." },
  payable_pay: { path: (key) => `/finance/payables/${key}/payouts`, method: "POST", fields: ["method", "amount", "paid_on", "operation_ref", "fx_rate", "lock_version"], failure: "No pudimos registrar el pago al proveedor." },
  payable_cancel: { path: (key) => `/finance/payables/${key}/cancel`, method: "POST", fields: ["reason"], failure: "No pudimos anular la obligación." },
  commission_calculate: { path: () => "/finance/commissions/calculate", method: "POST", fields: [], failure: "No pudimos calcular las comisiones." },
  commission_approve: { path: (key) => `/finance/commissions/${key}/approve`, method: "POST", fields: ["lock_version"], failure: "No pudimos aprobar la comisión." },
  commission_pay: { path: (key) => `/finance/commissions/${key}/pay`, method: "POST", fields: ["method", "reference", "lock_version"], failure: "No pudimos registrar el pago de la comisión." },
  commission_annul: { path: (key) => `/finance/commissions/${key}/annul`, method: "POST", fields: ["reason"], failure: "No pudimos anular la comisión." },
  invoice_issue: { path: () => "/finance/invoices", method: "POST", fields: ["receivable_id", "doc_type", "customer_doc_type", "customer_doc_number", "customer_name", "customer_address", "domiciled", "amount", "fx_rate", "description"], failure: "No pudimos emitir el comprobante." },
  invoice_credit: { path: () => "/finance/invoices", method: "POST", fields: ["doc_type", "ref_invoice_id", "credit_note_reason_code", "amount", "credit_note_reason"], failure: "No pudimos emitir la nota de crédito." },
  invoice_status: { path: (key) => `/finance/invoices/${key}/status-check`, method: "POST", fields: [], failure: "No pudimos consultar al OSE." },
  invoice_deliver: { path: (key) => `/finance/invoices/${key}/deliver`, method: "POST", fields: ["email"], failure: "No pudimos entregar el comprobante." },
  invoice_resend: { path: (key) => `/finance/invoices/${key}/resend`, method: "POST", fields: ["description", "fx_rate", "lock_version"], failure: "No pudimos reenviar el comprobante." },
  movement_create: { path: () => "/treasury/movements", method: "POST", fields: ["account", "direction", "amount", "date", "category", "description", "reference", "counterparty"], failure: "No pudimos registrar el movimiento." },
  movement_void: { path: (key) => `/treasury/movements/${key}/void`, method: "POST", fields: ["reason"], failure: "No pudimos anular el movimiento." },
  line_confirm: { path: (key) => `/finance/bank-lines/${key}/confirm`, method: "POST", fields: [], failure: "No pudimos confirmar la coincidencia." },
  line_reject: { path: (key) => `/finance/bank-lines/${key}/reject`, method: "POST", fields: [], failure: "No pudimos rechazar la coincidencia." },
  line_resolve: { path: (key) => `/finance/bank-lines/${key}/resolve`, method: "POST", fields: ["resolution", "note"], failure: "No pudimos resolver la línea." },
};

export async function financeStep(_state: StepResult, form: FormData): Promise<StepResult> {
  const step = STEPS[String(form.get("step") ?? "")];
  if (!step) return { message: "Acción no disponible.", done: false };
  const raw = String(form.get("key") ?? "");
  const key = encodeURIComponent(raw);
  const body = step.keyField ? { ...formValues(form, step.fields), [step.keyField]: raw } : formValues(form, step.fields);
  const result = await sendStep(step.path(key), step.method, body, step.failure);
  if (result.done) revalidatePath("/finanzas", "layout");
  return result;
}

export async function loadInvoiceDraft(code: string): Promise<{ draft: InvoiceDraft | null; message: string | null }> {
  const result = await apiFetch<InvoiceDraft>(`/finance/receivables/${encodeURIComponent(code)}/invoice-draft`);
  return result.ok ? { draft: result.data, message: null } : { draft: null, message: result.error?.message ?? "No pudimos preparar el comprobante." };
}

export async function checkInvoice(payload: Record<string, unknown>): Promise<InvoiceCheck | null> {
  const result = await apiFetch<InvoiceCheck>("/finance/invoices/validate", { method: "POST", body: payload });
  return result.ok ? result.data : null;
}
