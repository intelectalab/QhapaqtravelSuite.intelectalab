"use server";

import { revalidatePath } from "next/cache";
import { type AccessRequestState, type NotificationFeed, SEARCH_MIN, type SearchHit, type SearchResult, type UserNotification } from "@/lib/account";
import { apiFetch } from "@/lib/server/api";

export async function loadNotifications(): Promise<NotificationFeed | null> {
  const result = await apiFetch<{ data: UserNotification[]; meta: { unread_count: number; can_view_log: boolean } }>("/me/notifications", { raw: true });
  if (!result.ok || !result.data) return null;
  return { items: result.data.data, unread: result.data.meta.unread_count, canViewLog: result.data.meta.can_view_log };
}

export async function readAllNotifications(): Promise<number | null> {
  const result = await apiFetch<{ marked: number }>("/me/notifications/read-all", { method: "POST", body: {} });
  return result.ok && result.data ? result.data.marked : null;
}

export async function searchEverything(query: string): Promise<SearchResult> {
  const term = query.trim();
  if (term.length < SEARCH_MIN) return { items: [], scope: "tenant", message: null };
  const result = await apiFetch<{ data: SearchHit[]; meta: { scope: "own" | "tenant" } }>(`/search?q=${encodeURIComponent(term)}`, { raw: true });
  if (!result.ok || !result.data) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { items: [], scope: "tenant", message: firstError ?? result.error?.message ?? "No pudimos buscar en este momento." };
  }
  return { items: result.data.data, scope: result.data.meta.scope, message: null };
}

export async function requestAccess(_state: AccessRequestState, form: FormData): Promise<AccessRequestState> {
  const path = String(form.get("path") ?? "");
  const result = await apiFetch<{ notified: number }>("/access-requests", { method: "POST", body: { path } });
  if (!result.ok || !result.data) {
    return { message: result.error?.message ?? "No pudimos enviar la solicitud.", done: false };
  }
  const notified = result.data.notified;
  return { message: notified > 0 ? `Enviamos tu solicitud a ${notified === 1 ? "la persona que administra" : `las ${notified} personas que administran`} tu agencia.` : "Registramos tu solicitud. La administración de tu agencia la verá en su bandeja.", done: true };
}

export async function disableOwnMfa(_state: AccessRequestState, form: FormData): Promise<AccessRequestState> {
  if (form.get("confirm") !== "on") return { message: "Confirma que entiendes que tu cuenta quedará solo con contraseña.", done: false };
  const result = await apiFetch("/me/mfa", { method: "DELETE", body: {} });
  if (!result.ok) return { message: result.error?.message ?? "No pudimos desactivar la verificación en dos pasos.", done: false };
  revalidatePath("/", "layout");
  return { message: null, done: true };
}
