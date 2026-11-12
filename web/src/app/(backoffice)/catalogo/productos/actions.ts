"use server";

import { revalidatePath } from "next/cache";
import type { ChecklistItem } from "@/lib/catalog";
import { apiFetch } from "@/lib/server/api";

export interface ProductActionState {
  message: string | null;
  done: boolean;
  failed?: ChecklistItem[];
  code?: string;
}

const text = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" && value.trim() !== "" ? value.trim() : undefined;
};

const number = (form: FormData, key: string) => {
  const value = text(form, key);
  return value === undefined ? undefined : Number(value);
};

async function send(path: string, method: "POST" | "PATCH" | "DELETE", body: Record<string, unknown>): Promise<ProductActionState> {
  const result = await apiFetch<{ code: string }>(path, { method, body });
  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? "No pudimos guardar el producto.", done: false, failed: result.error?.details?.failed as ChecklistItem[] | undefined };
  }
  revalidatePath("/catalogo/productos", "layout");
  return { message: null, done: true, code: result.data?.code };
}

export async function changeProductStatus(_state: ProductActionState, form: FormData): Promise<ProductActionState> {
  return send(`/catalog/products/${encodeURIComponent(text(form, "code") ?? "")}/${text(form, "action")}`, "POST", { reason: text(form, "reason"), lock_version: number(form, "lock_version") });
}

export async function deleteProduct(_state: ProductActionState, form: FormData): Promise<ProductActionState> {
  return send(`/catalog/products/${encodeURIComponent(text(form, "code") ?? "")}`, "DELETE", { reason: text(form, "reason"), lock_version: number(form, "lock_version") });
}

export async function saveProductTranslation(_state: ProductActionState, form: FormData): Promise<ProductActionState> {
  const code = encodeURIComponent(text(form, "code") ?? "");
  const locale = encodeURIComponent(text(form, "locale") ?? "en");
  const result = await apiFetch(`/catalog/products/${code}/translations/${locale}`, {
    method: "PUT",
    body: { name: text(form, "name"), short: text(form, "short"), long: text(form, "long"), inclusions: text(form, "inclusions") ?? "", exclusions: text(form, "exclusions") ?? "", seo_title: text(form, "seo_title"), seo_description: text(form, "seo_description") },
  });
  if (!result.ok) {
    const firstError = result.error?.errors ? Object.values(result.error.errors)[0]?.[0] : undefined;
    return { message: firstError ?? result.error?.message ?? "No pudimos guardar la traducción.", done: false };
  }
  revalidatePath("/catalogo/productos", "layout");
  return { message: null, done: true };
}

export async function removeProductTranslation(_state: ProductActionState, form: FormData): Promise<ProductActionState> {
  const result = await apiFetch(`/catalog/products/${encodeURIComponent(text(form, "code") ?? "")}/translations/${encodeURIComponent(text(form, "locale") ?? "en")}`, { method: "DELETE" });
  if (!result.ok) return { message: result.error?.message ?? "No pudimos quitar la traducción.", done: false };
  revalidatePath("/catalogo/productos", "layout");
  return { message: null, done: true };
}

export async function createProductVersion(_state: ProductActionState, form: FormData): Promise<ProductActionState> {
  return send(`/catalog/products/${encodeURIComponent(text(form, "code") ?? "")}/versions`, "POST", { kind: text(form, "kind"), valid_from: text(form, "valid_from"), reason: text(form, "reason") });
}

export async function duplicateProduct(_state: ProductActionState, form: FormData): Promise<ProductActionState> {
  return send(`/catalog/products/${encodeURIComponent(text(form, "code") ?? "")}/duplicate`, "POST", {});
}

export interface VersionChange {
  field: string;
  before: string | number | boolean | null;
  after: string | number | boolean | null;
}

export async function compareProductVersions(code: string, from: string, to: string): Promise<{ changes: VersionChange[] } | { error: string }> {
  const result = await apiFetch<{ changes: VersionChange[] }>(`/catalog/products/${encodeURIComponent(code)}/versions/compare?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
  return result.ok && result.data ? result.data : { error: result.error?.message ?? "No pudimos comparar las versiones." };
}

export interface ResolvedRate {
  ref: string;
  type: string;
  segment: string;
  channel: string;
  currency: string;
  price: string;
  selectable: boolean;
  reason: string | null;
  season: boolean;
}

export async function resolveProductRate(code: string, date: string, segment: string, channel: string): Promise<{ chosen: string | null; rates: ResolvedRate[] } | { error: string }> {
  const query = new URLSearchParams({ date, segment, channel }).toString();
  const result = await apiFetch<{ chosen: string | null; rates: ResolvedRate[] }>(`/catalog/products/${encodeURIComponent(code)}/rates/resolve?${query}`);
  return result.ok && result.data ? result.data : { error: result.error?.message ?? "No pudimos resolver la tarifa." };
}
