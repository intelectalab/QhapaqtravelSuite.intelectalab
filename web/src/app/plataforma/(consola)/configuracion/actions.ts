"use server";

import { revalidatePath } from "next/cache";
import { SEARCH_MIN, type SearchHit, type SearchResult } from "@/lib/account";
import type { AdminActionState } from "@/lib/admin";
import { apiFetch } from "@/lib/server/api";

const text = (form: FormData, field: string) => String(form.get(field) ?? "").trim();

async function send(path: string, method: string, body: Record<string, unknown>, failure: string): Promise<AdminActionState> {
  const result = await apiFetch(`/platform${path}`, { method, body, realm: "platform" });
  if (!result.ok) {
    const first = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { done: false, message: first ?? result.error?.message ?? failure };
  }
  revalidatePath("/plataforma", "layout");
  return { done: true, message: null };
}

export async function readPlatformNotifications(): Promise<number | null> {
  const result = await apiFetch<{ marked: number }>("/platform/notifications/read-all", { method: "POST", body: {}, realm: "platform" });
  return result.ok && result.data ? result.data.marked : null;
}

export async function savePlatformSettings(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  const section = text(form, "section");
  const lock_version = Number(text(form, "lock_version"));
  const body: Record<string, unknown> =
    section === "issuer"
      ? { name: text(form, "name"), ruc: text(form, "ruc"), address: text(form, "address"), email: text(form, "email"), web: text(form, "web") || null }
      : section === "taxes"
        ? { igv_pct: text(form, "igv_pct") }
        : {
            trial_days: text(form, "trial_days").split(/[\s,;]+/).filter(Boolean).map(Number),
            usage_warn_pct: text(form, "usage_warn_pct"),
            api_key_days: text(form, "api_key_days"),
          };
  return send(`/settings/${encodeURIComponent(section)}`, "PATCH", { ...body, lock_version }, "No pudimos guardar la configuración.");
}

export async function saveFormProtection(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return send("/settings/form-protection", "PUT", { enabled: form.get("enabled") === "on", site_key: text(form, "site_key"), secret: text(form, "secret") }, "No pudimos guardar la protección de formularios.");
}

export async function savePlatformBranding(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return send("/branding", "PUT", { brand: text(form, "brand"), accent: text(form, "accent"), menu: text(form, "menu"), tile_variant: text(form, "tile_variant") }, "No pudimos guardar la apariencia.");
}

export async function resetPlatformBranding(_state: AdminActionState, form: FormData): Promise<AdminActionState> {
  return send("/branding/reset", "POST", { reason: text(form, "reason") }, "No pudimos restablecer la apariencia.");
}

export async function searchPlatform(query: string): Promise<SearchResult> {
  const term = query.trim();
  if (term.length < SEARCH_MIN) return { items: [], scope: "platform", message: null };
  const result = await apiFetch<SearchHit[]>(`/platform/search?q=${encodeURIComponent(term)}`, { realm: "platform" });
  if (!result.ok || !result.data) return { items: [], scope: "platform", message: result.error?.message ?? "No pudimos buscar en este momento." };
  return { items: result.data, scope: "platform", message: null };
}
