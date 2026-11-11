"use server";

import type { QuoteVersion } from "@/lib/quotes";
import type { ReservationDetail } from "@/lib/reservations";
import { apiFetch } from "@/lib/server/api";

export type ApprovalOriginData =
  | { kind: "quote"; currency: string; version: QuoteVersion }
  | { kind: "receivables"; reservation: string; currency: string; applied: string[]; receivables: NonNullable<ReservationDetail["receivables"]> };

interface OriginRequest {
  type: string;
  target: string;
  version?: number;
  reservation?: string | null;
  subject?: { type: string; code: string | null } | null;
  currency: string;
}

interface PaymentOrigin {
  reservation: { code: string } | null;
  applications: { code: string; reversed_at: string | null }[];
}

const failure = (status: number, message: string | undefined, fallback: string) => ({ origin: null, message: status === 403 ? null : (message ?? fallback) });

export async function loadApprovalOrigin(request: OriginRequest): Promise<{ origin: ApprovalOriginData | null; message: string | null }> {
  if (request.type === "quote" && request.version !== undefined) {
    const result = await apiFetch<QuoteVersion>(`/quotes/${encodeURIComponent(request.target)}/versions/${request.version}`);
    if (!result.ok || !result.data) return failure(result.status, result.error?.message, "No pudimos cargar las líneas de la cotización.");
    return { origin: { kind: "quote", currency: request.currency, version: result.data }, message: null };
  }
  let reservation = ["cancel", "change"].includes(request.type) ? request.target : (request.reservation ?? null);
  let applied: string[] = [];
  if (!reservation && request.subject?.type === "fin_payments" && request.subject.code) {
    const payment = await apiFetch<PaymentOrigin>(`/finance/payments/${encodeURIComponent(request.subject.code)}`);
    if (!payment.ok || !payment.data) return failure(payment.status, payment.error?.message, "No pudimos cargar el pago de la solicitud.");
    reservation = payment.data.reservation?.code ?? null;
    applied = payment.data.applications.filter((application) => application.reversed_at === null).map((application) => application.code);
  }
  if (!reservation) return { origin: null, message: null };
  const result = await apiFetch<ReservationDetail>(`/reservations/${encodeURIComponent(reservation)}`);
  if (!result.ok || !result.data) return failure(result.status, result.error?.message, "No pudimos cargar las cuentas por cobrar de la reserva.");
  const receivables = result.data.receivables ?? [];
  return { origin: receivables.length > 0 ? { kind: "receivables", reservation, currency: request.currency, applied, receivables } : null, message: null };
}
