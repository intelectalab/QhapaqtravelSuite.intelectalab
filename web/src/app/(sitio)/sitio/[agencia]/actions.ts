"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cartCookie, orderCookie, type CalendarMonth, type Quote, type SiteFormState } from "@/lib/site";
import { readSite, sendSite, siteBase } from "@/lib/server/site";

function text(form: FormData, key: string): string | undefined {
  const value = form.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
}

function list(form: FormData, key: string): string[] {
  return form.getAll(key).filter((value): value is string => typeof value === "string" && value !== "");
}

function flag(form: FormData, key: string): boolean {
  return form.get(key) === "on" || form.get(key) === "1" || form.get(key) === "true";
}

async function submit(agencia: string, path: string, body: Record<string, unknown>, failure: string): Promise<SiteFormState> {
  const result = await sendSite<Record<string, unknown>>(agencia, path, body);
  if (result.ok) return { status: "done", data: result.data ?? {} };
  const errors = Object.fromEntries(Object.entries(result.error?.errors ?? {}).map(([key, messages]) => [key.split(".")[0], messages[0]]));
  return { status: "error", message: result.status === 429 ? "Recibimos muchos envíos seguidos. Intenta de nuevo en un minuto." : result.status === 422 && Object.keys(errors).length > 0 ? "Revisa los datos marcados." : (result.error?.message ?? failure), errors };
}

export async function sendNewsletter(agencia: string, _state: SiteFormState, form: FormData): Promise<SiteFormState> {
  return submit(agencia, "/newsletter", { email: text(form, "email"), name: text(form, "name"), consent: flag(form, "consent") }, "No pudimos registrar tu suscripción.");
}

export async function sendLead(agencia: string, _state: SiteFormState, form: FormData): Promise<SiteFormState> {
  const undefinedDates = flag(form, "undefined_dates");
  return submit(
    agencia,
    "/leads",
    {
      name: text(form, "name"),
      email: text(form, "email"),
      phone: text(form, "phone"),
      country: text(form, "country"),
      destinations: list(form, "destinations"),
      product: text(form, "product"),
      undefined_dates: undefinedDates,
      start_date: undefinedDates ? undefined : text(form, "start_date"),
      end_date: undefinedDates ? undefined : text(form, "end_date"),
      flexibility: text(form, "flexibility"),
      adults: Number(text(form, "adults") ?? 1),
      children: Number(text(form, "children") ?? 0),
      budget: text(form, "budget"),
      interests: list(form, "interests"),
      hotel: text(form, "hotel"),
      service_mode: text(form, "service_mode"),
      preferred_contact: text(form, "preferred_contact"),
      comments: text(form, "comments"),
      consent: flag(form, "consent"),
    },
    "No pudimos enviar tu solicitud.",
  );
}

export async function sendContact(agencia: string, _state: SiteFormState, form: FormData): Promise<SiteFormState> {
  return submit(
    agencia,
    "/contact",
    { name: text(form, "name"), email: text(form, "email"), phone: text(form, "phone"), reason: text(form, "reason"), reservation: text(form, "reservation"), message: text(form, "message"), consent: flag(form, "consent") },
    "No pudimos enviar tu mensaje.",
  );
}

export async function sendClaim(agencia: string, _state: SiteFormState, form: FormData): Promise<SiteFormState> {
  return submit(
    agencia,
    "/claims",
    {
      name: text(form, "name"),
      doc_type: text(form, "doc_type"),
      doc_number: text(form, "doc_number"),
      email: text(form, "email"),
      phone: text(form, "phone"),
      address: text(form, "address"),
      minor: flag(form, "minor"),
      guardian_name: text(form, "guardian_name"),
      guardian_doc: text(form, "guardian_doc"),
      sede_id: text(form, "sede_id"),
      good_kind: text(form, "good_kind"),
      good_description: text(form, "good_description"),
      good_amount: text(form, "good_amount"),
      good_currency: text(form, "good_currency"),
      type: text(form, "type"),
      detail: text(form, "detail"),
      request: text(form, "request"),
      reservation: text(form, "reservation"),
      declaration: flag(form, "declaration"),
    },
    "No pudimos registrar la hoja de reclamación.",
  );
}

export async function loadMonth(agencia: string, slug: string, month: string, pax: number): Promise<CalendarMonth | null> {
  const result = await readSite<CalendarMonth>(agencia, `/products/${encodeURIComponent(slug)}/calendar?mes=${month}&viajeros=${pax}`);
  return result.ok ? result.data : null;
}

export async function quoteProduct(agencia: string, slug: string, input: { date: string; adults: number; children: number; infants: number; promo?: string }): Promise<{ quote: Quote | null; error: string | null }> {
  const result = await sendSite<Quote>(agencia, `/products/${encodeURIComponent(slug)}/quote`, input);
  return result.ok ? { quote: result.data, error: null } : { quote: null, error: result.error?.message ?? "No pudimos calcular el precio." };
}

const CART_DAYS = 30;

async function cartToken(agencia: string): Promise<string | undefined> {
  return (await cookies()).get(cartCookie(agencia))?.value;
}

export async function addToCart(agencia: string, input: { product: string; date: string; adults: number; children: number; infants: number; promo?: string }): Promise<{ ok: boolean; message: string | null }> {
  const token = await cartToken(agencia);
  const result = await sendSite<{ token: string }>(agencia, "/cart/items", input, token ? { "X-Cart-Token": token } : {});
  if (!result.ok || !result.data) return { ok: false, message: result.error?.message ?? "No pudimos agregar el producto al carrito." };
  (await cookies()).set(cartCookie(agencia), result.data.token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: CART_DAYS * 86_400 });
  return { ok: true, message: null };
}

export async function removeCartLine(agencia: string, line: number): Promise<string | null> {
  const token = await cartToken(agencia);
  const result = await sendSite(agencia, `/cart/items/${line}`, {}, token ? { "X-Cart-Token": token } : {}, "DELETE");
  revalidatePath(`/sitio/${agencia}/carrito`);
  return result.ok ? null : result.status === 404 ? "Tu carrito expiró o esa línea ya no existe." : (result.error?.message ?? "No pudimos quitar la línea.");
}

export async function reholdCartLine(agencia: string, line: number): Promise<string | null> {
  const token = await cartToken(agencia);
  const result = await sendSite(agencia, `/cart/items/${line}/hold`, {}, token ? { "X-Cart-Token": token } : {});
  revalidatePath(`/sitio/${agencia}/carrito`);
  return result.ok ? null : result.status === 404 ? "Tu carrito expiró o esa línea ya no existe." : (result.error?.message ?? "No pudimos volver a bloquear los cupos.");
}

export async function placeOrder(agencia: string, _state: SiteFormState, form: FormData): Promise<SiteFormState> {
  const token = await cartToken(agencia);
  if (!token) return { status: "error", message: "Tu carrito expiró. Vuelve a elegir tus fechas." };
  const result = await sendSite<{ code: string; token: string }>(
    agencia,
    "/checkout",
    {
      name: text(form, "name"),
      email: text(form, "email"),
      phone: text(form, "phone"),
      country: text(form, "country"),
      doc_type: text(form, "doc_type"),
      doc_number: text(form, "doc_number"),
      billing_type: text(form, "billing_type") ?? "Boleta",
      ruc: text(form, "ruc"),
      business_name: text(form, "business_name"),
      fiscal_address: text(form, "fiscal_address"),
      terms: flag(form, "terms"),
      privacy: flag(form, "privacy"),
      marketing: flag(form, "marketing"),
    },
    { "X-Cart-Token": token },
  );
  if (!result.ok || !result.data) {
    const errors = Object.fromEntries(Object.entries(result.error?.errors ?? {}).map(([key, messages]) => [key, messages[0]]));
    return { status: "error", message: Object.keys(errors).length > 0 ? "Revisa los datos marcados." : (result.status === 404 ? "Tu carrito expiró. Vuelve a elegir tus fechas." : (result.error?.message ?? "No pudimos crear tu pedido.")), errors };
  }
  const store = await cookies();
  store.set(orderCookie(result.data.code), result.data.token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: CART_DAYS * 86_400 });
  store.delete(cartCookie(agencia));
  redirect(`${await siteBase(agencia)}/confirmacion/${result.data.code}`);
}

export async function payOrder(agencia: string, code: string): Promise<string | null> {
  const token = (await cookies()).get(orderCookie(code))?.value;
  const result = await sendSite(agencia, `/orders/${encodeURIComponent(code)}/pay`, {}, token ? { "X-Order-Token": token } : {});
  revalidatePath(`/sitio/${agencia}/confirmacion/${code}`);
  return result.ok ? null : result.status === 404 ? "No encontramos el pedido en este navegador." : (result.error?.message ?? "No pudimos registrar el pago simulado.");
}
