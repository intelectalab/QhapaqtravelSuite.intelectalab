"use server";

import type { FormResult, NewsletterSource, PopupPage, PublicPopup } from "@/lib/landing-content";
import { apiFetch } from "@/lib/server/api";
import { getPopups, visitorHeaders } from "@/lib/server/landing-content";

const firstErrors = (errors: Record<string, string[]> | undefined) => Object.fromEntries(Object.entries(errors ?? {}).map(([field, messages]) => [field, messages[0] ?? ""]));

async function post<T extends { message?: string; status?: string }>(path: string, body: unknown): Promise<FormResult & { data?: T }> {
  const result = await apiFetch<T>(path, { method: "POST", body, auth: false, headers: await visitorHeaders() });
  if (!result.ok || !result.data) {
    const errors = firstErrors(result.error?.errors);
    return { ok: false, message: Object.keys(errors).length > 0 ? (Object.values(errors)[0] ?? "Revisa los datos.") : (result.error?.message ?? "No pudimos enviarlo. Inténtalo de nuevo."), errors };
  }
  return { ok: true, message: result.data.message ?? "Listo.", status: result.data.status, data: result.data };
}

export async function subscribeNewsletter(_state: FormResult | null, form: FormData): Promise<FormResult> {
  const source = String(form.get("source") ?? "pie") as NewsletterSource;
  return post("/public/landing/newsletter", { email: String(form.get("email") ?? ""), source, website: String(form.get("website") ?? "") });
}

export async function submitComment(_state: FormResult | null, form: FormData): Promise<FormResult> {
  const slug = String(form.get("slug") ?? "");
  return post(`/public/landing/blog/${encodeURIComponent(slug)}/comments`, {
    name: String(form.get("name") ?? ""),
    email: String(form.get("email") ?? ""),
    body: String(form.get("body") ?? ""),
    parent_id: String(form.get("parent_id") ?? "") || null,
    consent: form.get("consent") === "on",
    website: String(form.get("website") ?? ""),
  });
}

export async function markCommentUseful(id: string): Promise<{ counted: boolean; useful: number; message: string } | null> {
  const result = await apiFetch<{ counted: boolean; useful: number; message: string }>(`/public/landing/comments/${encodeURIComponent(id)}/useful`, { method: "POST", body: {}, auth: false, headers: await visitorHeaders() });
  return result.ok ? result.data : null;
}

export async function ratePost(slug: string, useful: boolean): Promise<{ counted: boolean; yes: number; no: number; message: string } | null> {
  const result = await apiFetch<{ counted: boolean; yes: number; no: number; message: string }>(`/public/landing/blog/${encodeURIComponent(slug)}/rating`, { method: "POST", body: { useful }, auth: false, headers: await visitorHeaders() });
  return result.ok ? result.data : null;
}

export async function countRead(slug: string): Promise<void> {
  await apiFetch(`/public/landing/blog/${encodeURIComponent(slug)}/read`, { method: "POST", body: {}, auth: false, headers: await visitorHeaders() });
}

export async function recordPopup(code: string, event: "view" | "conversion"): Promise<void> {
  await apiFetch(`/public/landing/popups/${encodeURIComponent(code)}/events`, { method: "POST", body: { event }, auth: false, headers: await visitorHeaders() });
}

export async function loadPopups(page: PopupPage): Promise<PublicPopup[]> {
  return getPopups(page);
}

export async function confirmNewsletter(token: string): Promise<FormResult & { email?: string }> {
  const result = await apiFetch<{ status: string; email: string; message: string }>(`/public/landing/newsletter/confirm/${encodeURIComponent(token)}`, { method: "POST", body: {}, auth: false });
  return result.ok && result.data ? { ok: true, message: result.data.message, status: result.data.status, email: result.data.email } : { ok: false, message: result.error?.message ?? "No pudimos confirmar tu suscripción." };
}

export async function unsubscribeNewsletter(_state: FormResult | null, form: FormData): Promise<FormResult> {
  return post("/public/landing/newsletter/unsubscribe", { token: String(form.get("token") ?? "") });
}
