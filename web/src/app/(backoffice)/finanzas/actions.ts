"use server";

import { revalidatePath } from "next/cache";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

interface FinanceStepConfig {
  path: (key: string) => string;
  method: "POST" | "PATCH";
  fields: string[];
  failure: string;
}

const STEPS: Record<string, FinanceStepConfig> = {
  receivable_payment: { path: (key) => `/finance/receivables/${key}/payments`, method: "POST", fields: ["method", "amount", "paid_on", "reference", "fx_rate", "note"], failure: "No pudimos registrar el pago." },
  receivable_cancel: { path: (key) => `/finance/receivables/${key}/cancel`, method: "POST", fields: ["reason"], failure: "No pudimos anular la cuota." },
  payment_confirm: { path: (key) => `/finance/payments/${key}/confirm`, method: "POST", fields: ["receivable"], failure: "No pudimos validar el pago." },
  payment_reject: { path: (key) => `/finance/payments/${key}/reject`, method: "POST", fields: ["reason"], failure: "No pudimos rechazar el pago." },
  payment_revert: { path: (key) => `/finance/payments/${key}/revert`, method: "POST", fields: ["reason"], failure: "No pudimos revertir el pago." },
  payable_create: { path: () => "/finance/payables", method: "POST", fields: ["reservation", "provider", "cost_type", "concept", "amount", "currency", "fx_rate", "due_date", "supplier_doc", "evidence"], failure: "No pudimos registrar el costo." },
  payable_update: { path: (key) => `/finance/payables/${key}`, method: "PATCH", fields: ["concept", "amount", "due_date", "supplier_doc", "evidence"], failure: "No pudimos guardar los cambios." },
  payable_approve: { path: (key) => `/finance/payables/${key}/approve`, method: "POST", fields: [], failure: "No pudimos aprobar la obligación." },
  payable_pay: { path: (key) => `/finance/payables/${key}/payouts`, method: "POST", fields: ["method", "amount", "paid_on", "operation_ref", "fx_rate"], failure: "No pudimos registrar el pago al proveedor." },
  payable_cancel: { path: (key) => `/finance/payables/${key}/cancel`, method: "POST", fields: ["reason"], failure: "No pudimos anular la obligación." },
  commission_calculate: { path: () => "/finance/commissions/calculate", method: "POST", fields: [], failure: "No pudimos calcular las comisiones." },
  commission_approve: { path: (key) => `/finance/commissions/${key}/approve`, method: "POST", fields: [], failure: "No pudimos aprobar la comisión." },
  commission_pay: { path: (key) => `/finance/commissions/${key}/pay`, method: "POST", fields: ["method", "reference"], failure: "No pudimos registrar el pago de la comisión." },
  commission_annul: { path: (key) => `/finance/commissions/${key}/annul`, method: "POST", fields: ["reason"], failure: "No pudimos anular la comisión." },
  invoice_credit: { path: (key) => `/finance/invoices/${key}/credit-notes`, method: "POST", fields: ["reason_code", "amount", "detail"], failure: "No pudimos emitir la nota de crédito." },
  invoice_status: { path: (key) => `/finance/invoices/${key}/fiscal-status`, method: "POST", fields: [], failure: "No pudimos consultar al OSE." },
  movement_create: { path: () => "/finance/treasury/movements", method: "POST", fields: ["account", "direction", "amount", "date", "category", "description", "reference", "counterparty"], failure: "No pudimos registrar el movimiento." },
  movement_void: { path: (key) => `/finance/treasury/movements/${key}/void`, method: "POST", fields: ["reason"], failure: "No pudimos anular el movimiento." },
  line_confirm: { path: (key) => `/finance/reconciliation/${key}/confirm`, method: "POST", fields: [], failure: "No pudimos confirmar la coincidencia." },
  line_reject: { path: (key) => `/finance/reconciliation/${key}/reject`, method: "POST", fields: [], failure: "No pudimos rechazar la coincidencia." },
  line_resolve: { path: (key) => `/finance/reconciliation/${key}/resolve`, method: "POST", fields: ["resolution", "note"], failure: "No pudimos resolver la línea." },
};

export async function financeStep(_state: StepResult, form: FormData): Promise<StepResult> {
  const step = STEPS[String(form.get("step") ?? "")];
  if (!step) return { message: "Acción no disponible.", done: false };
  const key = encodeURIComponent(String(form.get("key") ?? ""));
  const result = await sendStep(step.path(key), step.method, formValues(form, step.fields), step.failure);
  if (result.done) revalidatePath("/finanzas", "layout");
  return result;
}
