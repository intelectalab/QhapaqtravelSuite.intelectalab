"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AGENCY_HOME, type PriceQuote } from "@/lib/b2b-portal";
import { apiFetch } from "@/lib/server/api";
import { formValues, sendStep, type StepResult } from "@/lib/server/resource";

function refresh(...paths: string[]) {
  for (const path of [AGENCY_HOME, ...paths]) revalidatePath(path);
}

function firstError(result: { error?: { message?: string; errors?: Record<string, string[]> } | null }, failure: string): string {
  const field = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
  return field ?? result.error?.message ?? failure;
}

export interface SimulationInput {
  product: string;
  date: string;
  adults: number;
  children: number;
}

export async function simulateBooking(input: SimulationInput): Promise<{ quote: PriceQuote | null; message: string | null }> {
  const result = await apiFetch<PriceQuote>("/b2b/reservations/quote-price", { method: "POST", body: input });
  if (!result.ok || !result.data) return { quote: null, message: firstError(result, "No pudimos calcular la tarifa.") };
  return { quote: result.data, message: null };
}

export async function createBooking(product: string, _state: StepResult, form: FormData): Promise<StepResult> {
  const adults = Number(form.get("adults") ?? 0);
  const children = Number(form.get("children") ?? 0);
  const passengers = Array.from({ length: adults + children }, (_, index) => ({
    name: String(form.get(`pax_name_${index}`) ?? "").trim() || null,
    doc_type: String(form.get(`pax_doc_type_${index}`) ?? "").trim() || null,
    doc_number: String(form.get(`pax_doc_${index}`) ?? "").trim() || null,
  }));
  const ownClient = form.get("client_mode") !== "final";
  const body = {
    product,
    date: form.get("date"),
    adults,
    children,
    pay_mode: form.get("pay_mode"),
    agency_ref: String(form.get("agency_ref") ?? "").trim() || null,
    notes: String(form.get("notes") ?? "").trim() || null,
    passengers,
    client: ownClient ? null : formValues(form, ["client_name", "client_doc_type", "client_doc_number", "client_email", "client_phone"]),
  };
  if (body.client) {
    const client = body.client;
    body.client = { name: client.client_name, doc_type: client.client_doc_type, doc_number: client.client_doc_number, email: client.client_email, phone: client.client_phone };
  }
  const result = await apiFetch<{ code: string }>("/b2b/reservations", { method: "POST", body });
  if (!result.ok || !result.data) return { message: firstError(result, "No pudimos crear la reserva."), done: false };
  refresh(`${AGENCY_HOME}/reservas`, `${AGENCY_HOME}/catalogo`, `${AGENCY_HOME}/cuenta`);
  redirect(`${AGENCY_HOME}/reservas/${result.data.code}?creada=1`);
}

export async function savePassenger(code: string, seq: number, _state: StepResult, form: FormData): Promise<StepResult> {
  const result = await sendStep(`/b2b/reservations/${encodeURIComponent(code)}/passengers/${seq}`, "PUT", formValues(form, ["full_name", "doc_type", "doc_number", "nationality", "birth_date"]), "No pudimos guardar el pasajero.");
  if (result.done) refresh(`${AGENCY_HOME}/reservas/${code}`, `${AGENCY_HOME}/reservas`);
  return result;
}

export async function requestCancel(code: string, _state: StepResult, form: FormData): Promise<StepResult> {
  const result = await sendStep(`/b2b/reservations/${encodeURIComponent(code)}/cancel-request`, "POST", formValues(form, ["reason", "detail"]), "No pudimos enviar la solicitud.");
  if (result.done) refresh(`${AGENCY_HOME}/reservas/${code}`, `${AGENCY_HOME}/reservas`);
  return result;
}

export async function withdrawCancel(code: string): Promise<StepResult> {
  const result = await sendStep(`/b2b/reservations/${encodeURIComponent(code)}/cancel-request`, "DELETE", {}, "No pudimos retirar la solicitud.");
  if (result.done) refresh(`${AGENCY_HOME}/reservas/${code}`, `${AGENCY_HOME}/reservas`);
  return result;
}

export async function reportPayment(receivable: string, reservation: string | null, _state: StepResult, form: FormData): Promise<StepResult> {
  const result = await sendStep(`/b2b/receivables/${encodeURIComponent(receivable)}/payment-reports`, "POST", formValues(form, ["amount", "method", "reference", "paid_on", "note"]), "No pudimos informar el pago.");
  if (result.done) refresh(`${AGENCY_HOME}/cuenta`, ...(reservation ? [`${AGENCY_HOME}/reservas/${reservation}`] : []));
  return result;
}

export async function requestSettlement(): Promise<StepResult> {
  const result = await sendStep("/b2b/settlement-requests", "POST", {}, "No pudimos enviar la solicitud de liquidación.");
  if (result.done) refresh(`${AGENCY_HOME}/cuenta`);
  return result;
}
