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

const payload = (form: FormData) => ({
  name: text(form, "name"),
  code: text(form, "code"),
  sku: text(form, "sku"),
  type_id: text(form, "type_id"),
  category_id: text(form, "category_id"),
  subcategory_id: text(form, "subcategory_id"),
  destination_id: text(form, "destination_id"),
  provider_id: text(form, "provider_id"),
  short_description: text(form, "short_description"),
  duration_value: number(form, "duration_value"),
  duration_unit: text(form, "duration_unit"),
  modality: text(form, "modality"),
  minimum_passengers: number(form, "minimum_passengers"),
  maximum_passengers: number(form, "maximum_passengers"),
  minimum_age: number(form, "minimum_age"),
  maximum_age: number(form, "maximum_age"),
  booking_advance_min_days: number(form, "booking_advance_min_days"),
  booking_advance_max_days: number(form, "booking_advance_max_days"),
  availability_model: text(form, "availability_model"),
  markup_pct: number(form, "markup_pct"),
  is_b2b: form.get("is_b2b") === "on",
  is_ecommerce: form.get("is_ecommerce") === "on",
  lock_version: number(form, "lock_version"),
});

export async function createProduct(_state: ProductActionState, form: FormData): Promise<ProductActionState> {
  return send("/catalog/products", "POST", payload(form));
}

export async function updateProduct(_state: ProductActionState, form: FormData): Promise<ProductActionState> {
  return send(`/catalog/products/${encodeURIComponent(text(form, "current_code") ?? "")}`, "PATCH", payload(form));
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
