"use server";

import { apiFetch } from "@/lib/server/api";
import type { RlBooking, RlFormResult } from "@/lib/rutas-libres";

const text = (form: FormData, field: string) => String(form.get(field) ?? "").trim();

function failure(result: { error: { message: string; errors?: Record<string, string[]> } | null }, fallback: string): RlFormResult {
  const first = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
  return { ok: false, message: first ?? result.error?.message ?? fallback };
}

export interface BookingResult extends RlFormResult {
  booking?: RlBooking;
}

export async function bookTour(_state: BookingResult, form: FormData): Promise<BookingResult> {
  const slug = text(form, "slug");
  const body = {
    name: text(form, "name"),
    email: text(form, "email"),
    date: text(form, "date"),
    time: text(form, "time"),
    pax: Number(text(form, "pax") || 1),
    language: text(form, "language"),
    marketing_consent: form.get("marketing_consent") === "1",
    ...(text(form, "utm_source") ? { utm_source: text(form, "utm_source") } : {}),
  };
  if (body.name.length < 2 || !body.email.includes("@")) return { ok: false, message: "Escriba su nombre y un correo válido." };
  const result = await apiFetch<RlBooking>(`/showcase/listings/${encodeURIComponent(slug)}/bookings`, { method: "POST", body, auth: false });
  if (!result.ok || !result.data) return failure(result, "No pudimos registrar la reserva. Inténtelo de nuevo.");
  return { ok: true, message: null, booking: result.data };
}

export async function cancelBooking(_state: RlFormResult, form: FormData): Promise<RlFormResult> {
  const result = await apiFetch<{ code: string; status: string }>(`/showcase/bookings/${encodeURIComponent(text(form, "token"))}/cancel`, { method: "POST", body: {}, auth: false });
  if (result.status === 404) return { ok: false, message: "No encontramos la reserva. Revise que el enlace sea el de su correo de confirmación." };
  if (!result.ok || !result.data) return failure(result, "No pudimos cancelar la reserva.");
  return { ok: true, message: `La reserva ${result.data.code} quedó cancelada. Gracias por avisar: el cupo queda libre para otro viajero.` };
}

export async function registerAgency(_state: RlFormResult, form: FormData): Promise<RlFormResult> {
  const body = {
    name: text(form, "name"),
    city: text(form, "city").toLowerCase(),
    email: text(form, "email"),
    phone: text(form, "phone") || null,
    ruc: text(form, "ruc") || null,
    license_ref: text(form, "license_ref") || null,
    wants_pass: form.get("wants_pass") === "1",
    marketing_opt_in: form.get("marketing_opt_in") === "1",
  };
  const result = await apiFetch<{ code: string; wants_pass: boolean }>("/showcase/agencies", { method: "POST", body, auth: false });
  if (!result.ok || !result.data) return failure(result, "No pudimos enviar el registro.");
  return { ok: true, message: `Recibimos el registro de ${body.name} (${result.data.code}). Le escribiremos a ${body.email} para verificar la agencia${result.data.wants_pass ? " y, al aprobarla, activar su Pase Básico de 30 días" : ""}.` };
}
