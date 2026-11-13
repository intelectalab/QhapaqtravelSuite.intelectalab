"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { accountCookie, cartCookie, NO_EXTRAS, orderCookie, siteHref, type AccountMe, type ChatMessage, type BookingExtras, type CalendarMonth, type PaymentMode, type Quote, type SiteFormState } from "@/lib/site";
import { parseSiteLocale, SITE_LOCALE_COOKIE } from "@/lib/site-i18n";
import { captchaHeaders } from "@/lib/server/captcha";
import { apiFetch } from "@/lib/server/api";
import { accountFetch, accountToken, cartHeaders, readSite, sendSite, siteBase, siteRequestHeaders } from "@/lib/server/site";

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

async function submit(agencia: string, path: string, body: Record<string, unknown>, failure: string, form: FormData): Promise<SiteFormState> {
  const result = await sendSite<Record<string, unknown>>(agencia, path, body, captchaHeaders(form));
  if (result.ok) return { status: "done", data: result.data ?? {} };
  const errors = Object.fromEntries(Object.entries(result.error?.errors ?? {}).map(([key, messages]) => [key.split(".")[0], messages[0]]));
  return { status: "error", message: result.status === 429 ? "Recibimos muchos envíos seguidos. Intenta de nuevo en un minuto." : result.status === 422 && Object.keys(errors).length > 0 ? "Revisa los datos marcados." : (result.error?.message ?? failure), errors };
}

export async function sendNewsletter(agencia: string, _state: SiteFormState, form: FormData): Promise<SiteFormState> {
  return submit(agencia, "/newsletter", { email: text(form, "email"), name: text(form, "name"), consent: flag(form, "consent") }, "No pudimos registrar tu suscripción.", form);
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
    form,
  );
}

export async function sendContact(agencia: string, _state: SiteFormState, form: FormData): Promise<SiteFormState> {
  return submit(
    agencia,
    "/contact",
    { name: text(form, "name"), email: text(form, "email"), phone: text(form, "phone"), reason: text(form, "reason"), reservation: text(form, "reservation"), message: text(form, "message"), consent: flag(form, "consent") },
    "No pudimos enviar tu mensaje.",
    form,
  );
}

export async function sendClaim(agencia: string, _state: SiteFormState, form: FormData): Promise<SiteFormState> {
  return submit(
    agencia,
    "/claim-book",
    {
      name: text(form, "name"),
      doc_type: text(form, "doc_type"),
      doc_number: text(form, "doc_number"),
      email: text(form, "email"),
      phone: text(form, "phone"),
      address: text(form, "address"),
      is_minor: flag(form, "is_minor"),
      guardian_name: text(form, "guardian_name"),
      guardian_doc_type: text(form, "guardian_doc_type"),
      guardian_doc_number: text(form, "guardian_doc_number"),
      guardian_relation: text(form, "guardian_relation"),
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
    form,
  );
}

export async function loadMonth(agencia: string, slug: string, month: string, pax: number): Promise<CalendarMonth | null> {
  const result = await readSite<CalendarMonth>(agencia, `/products/${encodeURIComponent(slug)}/calendar?mes=${month}&viajeros=${pax}`);
  return result.ok ? result.data : null;
}

export interface QuoteInput {
  date: string;
  adults: number;
  children: number;
  infants: number;
  promo?: string;
  extras?: BookingExtras;
  payment_mode?: PaymentMode;
}

export async function quoteProduct(agencia: string, slug: string, input: QuoteInput): Promise<{ quote: Quote | null; error: string | null }> {
  const result = await sendSite<Quote>(agencia, "/price-quote", { product: slug, date: input.date, adults: input.adults, children: input.children, infants: input.infants, promo: input.promo, payment_mode: input.payment_mode, ...(input.extras ?? NO_EXTRAS) });
  return result.ok ? { quote: result.data, error: null } : { quote: null, error: result.error?.message ?? "No pudimos calcular el precio." };
}

const CART_DAYS = 30;

async function cartToken(agencia: string): Promise<string | undefined> {
  return (await cookies()).get(cartCookie(agencia))?.value;
}

export async function addToCart(agencia: string, input: { product: string; date: string; adults: number; children: number; infants: number; promo?: string; extras?: BookingExtras; quote_token?: string }): Promise<{ ok: boolean; message: string | null }> {
  const token = await cartToken(agencia);
  const { extras, ...rest } = input;
  const result = await sendSite<{ token: string }>(agencia, "/carts/current/items", { ...rest, ...(extras ?? NO_EXTRAS) }, cartHeaders(token));
  if (!result.ok || !result.data) return { ok: false, message: result.error?.message ?? "No pudimos agregar el producto al carrito." };
  (await cookies()).set(cartCookie(agencia), result.data.token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: CART_DAYS * 86_400 });
  return { ok: true, message: null };
}

export async function removeCartLine(agencia: string, line: number): Promise<string | null> {
  const token = await cartToken(agencia);
  const result = await sendSite(agencia, `/carts/current/items/${line}`, {}, cartHeaders(token), "DELETE");
  revalidatePath(`/sitio/${agencia}/carrito`);
  return result.ok ? null : result.status === 404 ? "Tu carrito expiró o esa línea ya no existe." : (result.error?.message ?? "No pudimos quitar la línea.");
}

export async function toggleCartItem(agencia: string, line: number, key: string, removed: boolean, lockVersion?: number): Promise<string | null> {
  const token = await cartToken(agencia);
  const result = await sendSite(agencia, `/carts/current/items/${line}/removed-lines`, { key, removed, lock_version: lockVersion }, cartHeaders(token), "PATCH");
  revalidatePath(`/sitio/${agencia}/carrito`);
  revalidatePath(`/sitio/${agencia}/checkout`);
  if (result.ok) return null;
  if (result.status === 409) return "Tu carrito cambió en otra pestaña. Recargamos los datos.";
  return result.status === 404 ? "Tu carrito expiró o esa línea ya no existe." : (result.error?.message ?? "No pudimos actualizar la línea.");
}

export async function updateCartLinePax(agencia: string, line: number, pax: { adults: number; children: number; infants: number }): Promise<string | null> {
  const token = await cartToken(agencia);
  const result = await sendSite(agencia, `/carts/current/items/${line}`, pax, cartHeaders(token), "PATCH");
  revalidatePath(`/sitio/${agencia}/carrito`);
  revalidatePath(`/sitio/${agencia}/checkout`);
  if (result.ok) return null;
  if (result.status === 409) return result.error?.message ?? "Ya no hay cupos para ese grupo en esta fecha.";
  return result.status === 404 ? "Tu carrito expiró o esa línea ya no existe." : (result.error?.message ?? "No pudimos cambiar los viajeros.");
}

export async function reholdCartLine(agencia: string, line: number): Promise<string | null> {
  const token = await cartToken(agencia);
  const result = await sendSite(agencia, `/carts/current/items/${line}/hold`, {}, cartHeaders(token));
  revalidatePath(`/sitio/${agencia}/carrito`);
  return result.ok ? null : result.status === 404 ? "Tu carrito expiró o esa línea ya no existe." : (result.error?.message ?? "No pudimos volver a bloquear los cupos.");
}

function fieldErrors(errors: Record<string, string[]> | undefined): Record<string, string> {
  return Object.fromEntries(Object.entries(errors ?? {}).map(([key, messages]) => [key, messages[0]]));
}

export async function validateCheckoutStep(agencia: string, step: string, payload: Record<string, unknown>): Promise<SiteFormState> {
  const token = await cartToken(agencia);
  if (!token) return { status: "error", message: "Tu carrito expiró. Vuelve a elegir tus fechas." };
  const result = await sendSite(agencia, "/checkout/validate", { ...payload, step }, cartHeaders(token));
  if (result.ok) return { status: "done" };
  const errors = fieldErrors(result.error?.errors);
  return { status: "error", message: Object.keys(errors).length > 0 ? "Revisa los datos marcados." : (result.error?.message ?? "No pudimos validar este paso."), errors };
}

export async function placeOrder(agencia: string, _state: SiteFormState, form: FormData): Promise<SiteFormState> {
  const token = await cartToken(agencia);
  if (!token) return { status: "error", message: "Tu carrito expiró. Vuelve a elegir tus fechas." };
  let payload: Record<string, unknown> = {};
  try {
    payload = JSON.parse(String(form.get("payload") ?? "{}"));
  } catch {
    return { status: "error", message: "No pudimos leer tus datos. Vuelve a intentarlo." };
  }
  const result = await sendSite<{ code: string; token: string; payment: { result: string; message: string } | null }>(agencia, "/checkout/orders", payload, { ...cartHeaders(token), ...captchaHeaders(form) });
  if (!result.ok || !result.data) {
    const errors = fieldErrors(result.error?.errors);
    return { status: "error", message: Object.keys(errors).length > 0 ? "Revisa los datos marcados." : (result.status === 404 ? "Tu carrito expiró. Vuelve a elegir tus fechas." : (result.error?.message ?? "No pudimos crear tu pedido.")), errors };
  }
  const store = await cookies();
  store.set(orderCookie(result.data.code), result.data.token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: CART_DAYS * 86_400 });
  store.delete(cartCookie(agencia));
  redirect(`${await siteBase(agencia)}/confirmacion/${result.data.code}`);
}

export async function payOrder(agencia: string, code: string, payment: Record<string, string>): Promise<{ ok: boolean; message: string | null }> {
  const token = (await cookies()).get(orderCookie(code))?.value;
  const orderHeaders: Record<string, string> = token ? { "X-Order-Token": token } : {};
  let body: Record<string, string> = payment;
  if (payment.method === "tarjeta") {
    const session = await sendSite<{ session_id: string }>(agencia, `/orders/${encodeURIComponent(code)}/payment-session`, {}, orderHeaders);
    if (!session.ok || !session.data) return { ok: false, message: session.error?.message ?? "La pasarela no respondió. Intenta de nuevo en unos minutos." };
    body = { ...payment, session_id: session.data.session_id };
  }
  const result = await sendSite<{ payment: { result: string; message: string } }>(agencia, `/orders/${encodeURIComponent(code)}/payments`, body, orderHeaders);
  revalidatePath(`/sitio/${agencia}/confirmacion/${code}`);
  if (!result.ok || !result.data) {
    const errors = fieldErrors(result.error?.errors);
    return { ok: false, message: Object.values(errors)[0] ?? (result.status === 404 ? "No encontramos el pedido en este navegador." : (result.error?.message ?? "No pudimos registrar el pago.")) };
  }
  return { ok: result.data.payment.result !== "rechazado", message: result.data.payment.message };
}

export async function setSiteLocale(locale: string): Promise<void> {
  (await cookies()).set(SITE_LOCALE_COOKIE, parseSiteLocale(locale), { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}

const ACCOUNT_DAYS = 30;

function wishlistOf(form: FormData): string[] {
  try {
    const parsed = JSON.parse(String(form.get("wishlist") ?? "[]"));
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string").slice(0, 50) : [];
  } catch {
    return [];
  }
}

function accountFailure(status: number, error: { message?: string; errors?: Record<string, string[]> } | null, fallback: string): SiteFormState {
  const errors = fieldErrors(error?.errors);
  if (status === 429) return { status: "error", message: "Hiciste varios intentos seguidos. Espera un minuto y vuelve a intentarlo." };
  return { status: "error", message: Object.keys(errors).length > 0 ? "Revisa los datos marcados." : (error?.message ?? fallback), errors };
}

async function openAccount(agencia: string, token: string): Promise<void> {
  (await cookies()).set(accountCookie(agencia), token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: ACCOUNT_DAYS * 86_400, secure: process.env.NODE_ENV === "production" });
}

function safeNext(value: string | undefined): string {
  return value && (value.startsWith("/cuenta") || value === "/checkout") && !value.startsWith("//") ? value : "/cuenta";
}

export async function registerAccount(agencia: string, _state: SiteFormState, form: FormData): Promise<SiteFormState> {
  const body = {
    name: text(form, "name"),
    email: text(form, "email"),
    phone: text(form, "phone"),
    country: text(form, "country"),
    doc_type: text(form, "doc_type"),
    doc_number: text(form, "doc_number"),
    password: String(form.get("password") ?? ""),
    password_confirmation: String(form.get("password_confirmation") ?? ""),
    accept: flag(form, "accept"),
    newsletter: flag(form, "newsletter"),
    wishlist: wishlistOf(form),
  };
  const result = await sendSite<{ token: string }>(agencia, "/auth/register", body, cartHeaders(await cartToken(agencia)));
  if (!result.ok || !result.data) return accountFailure(result.status, result.error, "No pudimos crear tu cuenta.");
  await openAccount(agencia, result.data.token);
  redirect(siteHref(await siteBase(agencia), "/cuenta?bienvenida=1"));
}

export async function loginAccount(agencia: string, _state: SiteFormState, form: FormData): Promise<SiteFormState> {
  const result = await sendSite<{ token: string }>(agencia, "/auth/login", { email: text(form, "email"), password: String(form.get("password") ?? ""), wishlist: wishlistOf(form) }, cartHeaders(await cartToken(agencia)));
  if (!result.ok || !result.data) return accountFailure(result.status, result.error, "No pudimos iniciar tu sesión.");
  await openAccount(agencia, result.data.token);
  redirect(siteHref(await siteBase(agencia), safeNext(text(form, "next"))));
}

export async function forgotAccount(agencia: string, _state: SiteFormState, form: FormData): Promise<SiteFormState> {
  const result = await sendSite<{ message: string }>(agencia, "/auth/password/forgot", { email: text(form, "email") });
  if (!result.ok || !result.data) return accountFailure(result.status, result.error, "No pudimos enviar el enlace.");
  return { status: "done", message: result.data.message };
}

export async function lookupOrder(agencia: string, _state: SiteFormState, form: FormData): Promise<SiteFormState> {
  const result = await sendSite<{ code: string; token: string }>(agencia, "/orders/lookup", { email: text(form, "email"), code: text(form, "code") });
  if (!result.ok || !result.data) return accountFailure(result.status, result.error, "No encontramos tu compra.");
  (await cookies()).set(orderCookie(result.data.code), result.data.token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 86_400 });
  redirect(siteHref(await siteBase(agencia), `/confirmacion/${result.data.code}`));
}

export async function logoutAccount(agencia: string): Promise<void> {
  if (await accountToken(agencia)) await accountFetch(agencia, "/auth/logout", { method: "POST", body: {} });
  (await cookies()).delete({ name: accountCookie(agencia), path: "/" });
  redirect(siteHref(await siteBase(agencia), "/cuenta/ingresar?salida=1"));
}

export async function resendVerification(agencia: string): Promise<{ ok: boolean; message: string }> {
  const result = await accountFetch<{ message: string }>(agencia, "/auth/email/resend", { method: "POST", body: {} });
  return { ok: result.ok, message: result.data?.message ?? result.error?.message ?? "No pudimos enviar el enlace." };
}

export async function updateAccount(agencia: string, _state: SiteFormState, form: FormData): Promise<SiteFormState> {
  const result = await accountFetch<AccountMe>(agencia, "/me", { method: "PATCH", body: { email: text(form, "email") ?? null, phone: text(form, "phone") ?? null, city: text(form, "city") ?? null, country: text(form, "country") ?? null, locale: text(form, "locale") ?? "es", newsletter: flag(form, "newsletter") } });
  if (!result.ok) return accountFailure(result.status, result.error, "No pudimos guardar tus datos.");
  revalidatePath(`/sitio/${agencia}/cuenta/datos`);
  return { status: "done", message: "Guardamos tus datos." };
}

export async function sendArcoRequest(agencia: string, _state: SiteFormState, form: FormData): Promise<SiteFormState> {
  const result = await accountFetch<{ code: string }>(agencia, "/me/arco-requests", { method: "POST", body: { type: text(form, "type"), detail: text(form, "detail") } });
  if (!result.ok) return accountFailure(result.status, result.error, "No pudimos registrar tu solicitud.");
  revalidatePath(`/sitio/${agencia}/cuenta/datos`);
  return { status: "done", message: "Registramos tu solicitud. Te responderemos dentro del plazo legal." };
}

export async function payReceivable(agencia: string, code: string, payment: Record<string, string>): Promise<{ ok: boolean; message: string | null }> {
  const result = await accountFetch<{ result: string; message: string }>(agencia, `/me/receivables/${encodeURIComponent(code)}/payments`, { method: "POST", body: payment });
  revalidatePath(`/sitio/${agencia}/cuenta/pagos`);
  if (!result.ok || !result.data) {
    const errors = fieldErrors(result.error?.errors);
    return { ok: false, message: Object.values(errors)[0] ?? result.error?.message ?? "No pudimos registrar el pago." };
  }
  return { ok: result.data.result !== "rechazado", message: result.data.message };
}

export async function toggleWish(agencia: string, slug: string, on: boolean): Promise<{ ok: boolean; signedIn: boolean }> {
  if (!(await accountToken(agencia))) return { ok: false, signedIn: false };
  const result = await accountFetch(agencia, `/me/wishlist/${encodeURIComponent(slug)}`, { method: on ? "PUT" : "DELETE", body: {} });
  revalidatePath(`/sitio/${agencia}/cuenta/deseos`);
  return { ok: result.ok, signedIn: result.status !== 401 };
}

export async function requestTripLink(agencia: string, _state: SiteFormState, form: FormData): Promise<SiteFormState> {
  const result = await apiFetch<{ message: string }>("/portal/passenger/auth/link", { method: "POST", auth: false, body: { email: text(form, "email"), code: text(form, "code") }, headers: await siteRequestHeaders(agencia) });
  if (!result.ok || !result.data) return accountFailure(result.status, result.error, "No pudimos enviar el enlace.");
  return { status: "done", message: result.data.message };
}

export async function unsubscribeNewsletter(agencia: string, token: string): Promise<SiteFormState> {
  const result = await sendSite<{ email: string }>(agencia, "/newsletter/unsubscribe", { token });
  if (!result.ok || !result.data) return accountFailure(result.status, result.error, "No pudimos procesar la baja.");
  return { status: "done", message: `Listo: ${result.data.email} ya no recibirá ofertas por correo.` };
}

export async function sendTokenReview(agencia: string, _state: SiteFormState, form: FormData): Promise<SiteFormState> {
  const subratings = Object.fromEntries([...form.entries()].filter(([key, value]) => key.startsWith("sub_") && typeof value === "string" && value !== "").map(([key, value]) => [key.slice(4), Number(value)]));
  return submit(agencia, "/reviews/by-token", { code: text(form, "code"), t: text(form, "t"), product: text(form, "product"), stars: Number(text(form, "stars") ?? 0), title: text(form, "title"), body: text(form, "body"), lang: text(form, "lang") ?? "es", country: text(form, "country"), subratings, consent_publish: flag(form, "consent_publish") }, "No pudimos enviar tu opinión.", form);
}

type ChatResult = { messages: ChatMessage[] | null; message: string | null; errors?: Record<string, string> };

const chatCookie = (agencia: string) => `kipucontrol_chat_${agencia}`;

async function chatSession(agencia: string): Promise<{ session: string; token: string } | null> {
  const raw = (await cookies()).get(chatCookie(agencia))?.value;
  const [session, token] = raw ? raw.split(".") : [];
  return session && token ? { session, token } : null;
}

export async function openSiteChat(agencia: string, input: { name: string; contact: string; message: string; consent: boolean }): Promise<ChatResult> {
  const contact = input.contact.trim();
  const email = contact.includes("@") ? contact : null;
  const result = await sendSite<{ session: string; token: string; messages: ChatMessage[] }>(agencia, "/chat/sessions", { name: input.name, email, whatsapp: email ? null : contact, message: input.message, consent: input.consent });
  if (!result.ok || !result.data) return { messages: null, message: result.status === 429 ? "Recibimos muchos mensajes seguidos. Intenta en un minuto." : (result.error?.message ?? "No pudimos abrir el chat."), errors: fieldErrors(result.error?.errors) };
  (await cookies()).set(chatCookie(agencia), `${result.data.session}.${result.data.token}`, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 7 * 86_400 });
  return { messages: result.data.messages, message: null };
}

export async function sendSiteChat(agencia: string, body: string): Promise<ChatResult> {
  const chat = await chatSession(agencia);
  if (!chat) return { messages: null, message: "Tu chat terminó. Abre uno nuevo." };
  const result = await sendSite<{ messages: ChatMessage[] }>(agencia, `/chat/sessions/${encodeURIComponent(chat.session)}/messages`, { body }, { "X-Chat-Token": chat.token });
  return result.ok && result.data ? { messages: result.data.messages, message: null } : { messages: null, message: result.error?.message ?? "No pudimos enviar tu mensaje." };
}

export async function readSiteChat(agencia: string): Promise<ChatResult> {
  const chat = await chatSession(agencia);
  if (!chat) return { messages: null, message: null };
  const result = await readSite<{ messages: ChatMessage[] }>(agencia, `/chat/sessions/${encodeURIComponent(chat.session)}`, { "X-Chat-Token": chat.token });
  if (result.status === 404) (await cookies()).delete(chatCookie(agencia));
  return result.ok && result.data ? { messages: result.data.messages, message: null } : { messages: null, message: null };
}

export async function recordSiteEvents(agencia: string, payload: { session_id: string; currency?: string; events: { event: string; params?: Record<string, unknown> }[] }): Promise<boolean> {
  const result = await sendSite<{ recorded: number }>(agencia, "/analytics/events", { ...payload, consent: true });
  return result.ok;
}
