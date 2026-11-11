"use server";

import { revalidatePath } from "next/cache";
import type { ProductDraft, ProductEditorState, ProductRateDraft, ProductReview } from "@/lib/catalog";
import { apiFetch, type ApiResult } from "@/lib/server/api";

export interface WizardFailure {
  message: string;
  step: number | null;
  fields: Record<string, string>;
}

export type WizardResult<T> = { ok: true; data: T } | { ok: false; error: WizardFailure };

export type ProductSection = "master" | "components" | "itinerary" | "seasons" | "availability" | "content" | "channels";

const MASTER_STEP: Record<string, number> = {
  category_id: 2,
  subcategory_id: 2,
  is_bookable: 2,
  is_quoteable: 2,
  is_b2b: 2,
  is_ecommerce: 2,
  is_featured: 2,
  markup_pct: 2,
  destination_id: 3,
  secondary_destination_ids: 3,
  provider_id: 4,
  main_provider_id: 4,
  components: 4,
  itinerary: 5,
  rates: 6,
  season_ids: 7,
  availability: 8,
  model: 8,
  capacity: 8,
  source: 8,
  content: 9,
  policies: 9,
  long_description: 9,
  seo_title: 9,
  seo_description: 9,
  slug: 9,
  video_url: 9,
  inclusions: 9,
  exclusions: 9,
  requirements: 9,
  faqs: 9,
  media: 9,
  cancellation: 9,
  modification: 9,
  no_show: 9,
  refund: 9,
  penalties: 9,
  date_change: 9,
  channels: 10,
};

function stepOf(field: string): number {
  return MASTER_STEP[field.split(".")[0]] ?? 1;
}

function failure<T>(result: ApiResult<T>, fallback: string): { ok: false; error: WizardFailure } {
  const errors = result.error?.errors ?? {};
  const fields = Object.fromEntries(Object.entries(errors).map(([field, messages]) => [field, messages[0] ?? ""]));
  const detailStep = typeof result.error?.details?.step === "number" ? result.error.details.step : null;
  const detailField = typeof result.error?.details?.field === "string" ? result.error.details.field : null;
  const firstField = Object.keys(fields)[0];
  const message = (firstField ? fields[firstField] : null) ?? result.error?.message ?? fallback;
  if (detailField) fields[detailField] = message;
  return { ok: false, error: { message, step: detailStep ?? (firstField ? stepOf(firstField) : null), fields } };
}

function rateBody(rate: ProductRateDraft): Record<string, unknown> {
  const optional = (value: string | null | undefined) => (value === undefined || value === null || String(value).trim() === "" ? null : value);
  return { rate_type: rate.rate_type, segment: rate.segment, channel: rate.channel, currency: rate.currency, price_basis: rate.price_basis, cost: rate.cost ?? 0, price: rate.price, min_price: optional(rate.min_price), max_price: optional(rate.max_price), conditions: optional(rate.conditions), valid_from: rate.valid_from, valid_to: rate.valid_to, season_id: rate.season_id };
}

function payload(draft: ProductDraft): Record<string, unknown> {
  return {
    ...draft.master,
    provider_id: draft.main_provider_id,
    secondary_destination_ids: draft.secondary_destination_ids,
    components: draft.components.map((component) => ({ id: component.id, service_id: component.service_id, component_product_id: component.component_product_id, quantity: component.quantity, is_required: component.is_required, is_included: component.is_included, notes: component.notes })),
    itinerary: draft.itinerary,
    rates: draft.rates.map(rateBody),
    season_ids: draft.season_ids,
    availability: draft.availability,
    content: draft.content,
    policies: draft.policies,
    channels: draft.channels.filter((channel) => channel !== "erp"),
  };
}

export async function previewProductDraft(draft: ProductDraft, step: number): Promise<WizardResult<{ review: ProductReview | null }>> {
  const result = await apiFetch<{ review: ProductReview | null }>("/catalog/products/preview", { method: "POST", body: { ...payload(draft), step } });
  return result.ok && result.data ? { ok: true, data: result.data } : failure(result, "No pudimos revisar este paso.");
}

export async function createProductFromDraft(draft: ProductDraft): Promise<WizardResult<{ code: string }>> {
  const result = await apiFetch<{ code: string }>("/catalog/products", { method: "POST", body: payload(draft) });
  if (!result.ok || !result.data) return failure(result, "No pudimos crear el producto.");
  revalidatePath("/catalogo/productos", "layout");
  return { ok: true, data: result.data };
}

async function readEditor(code: string): Promise<WizardResult<ProductEditorState>> {
  const result = await apiFetch<ProductEditorState>(`/catalog/products/${encodeURIComponent(code)}/editor`);
  return result.ok && result.data ? { ok: true, data: result.data } : failure(result, "No pudimos cargar el producto.");
}

export async function saveProductSection(code: string, lockVersion: number, section: ProductSection, draft: ProductDraft): Promise<WizardResult<ProductEditorState>> {
  const path = `/catalog/products/${encodeURIComponent(code)}`;
  const body = payload(draft);

  if (section === "master") {
    const result = await apiFetch<{ code: string }>(path, { method: "PATCH", body: { ...draft.master, provider_id: draft.main_provider_id, secondary_destination_ids: draft.secondary_destination_ids, lock_version: lockVersion } });
    if (!result.ok || !result.data) return failure(result, "No pudimos guardar la ficha.");
    revalidatePath("/catalogo/productos", "layout");
    return readEditor(result.data.code);
  }

  const sections: Record<Exclude<ProductSection, "master">, Record<string, unknown>> = {
    components: { main_provider_id: draft.main_provider_id, components: body.components },
    itinerary: { itinerary: draft.itinerary },
    seasons: { season_ids: draft.season_ids },
    availability: { ...draft.availability },
    content: { ...draft.content },
    channels: { channels: body.channels },
  };

  const result = await apiFetch<ProductEditorState>(`${path}/${section}`, { method: "PUT", body: { ...sections[section], lock_version: lockVersion } });
  if (!result.ok || !result.data) return failure(result, "No pudimos guardar los cambios.");

  if (section === "content") {
    const policies = await apiFetch<ProductEditorState>(`${path}/policies`, { method: "PUT", body: { ...draft.policies, lock_version: result.data.lock_version } });
    if (!policies.ok || !policies.data) return failure(policies, "No pudimos guardar las políticas.");
    revalidatePath("/catalogo/productos", "layout");
    return { ok: true, data: policies.data };
  }

  revalidatePath("/catalogo/productos", "layout");
  return { ok: true, data: result.data };
}

export async function addProductRate(code: string, rate: ProductRateDraft): Promise<WizardResult<ProductEditorState>> {
  const result = await apiFetch<{ ref: string }>(`/catalog/products/${encodeURIComponent(code)}/rates`, {
    method: "POST",
    body: rateBody(rate),
  });
  if (!result.ok) {
    const failed = failure(result, "No pudimos agregar la tarifa.");
    return { ok: false, error: { ...failed.error, step: 6, fields: Object.fromEntries(Object.entries(failed.error.fields).map(([field, message]) => [`rates.0.${field}`, message])) } };
  }
  revalidatePath("/catalogo/productos", "layout");
  return readEditor(code);
}

function rateFailure(result: ApiResult<unknown>, fallback: string): { ok: false; error: WizardFailure } {
  const failed = failure(result, fallback);
  return { ok: false, error: { ...failed.error, step: 6, fields: Object.fromEntries(Object.entries(failed.error.fields).map(([field, message]) => [`rates.0.${field}`, message])) } };
}

export async function updateProductRate(code: string, rate: ProductRateDraft, reason: string | null): Promise<WizardResult<ProductEditorState>> {
  const result = await apiFetch(`/catalog/products/${encodeURIComponent(code)}/rates/${encodeURIComponent(rate.ref ?? "")}/price`, {
    method: "PATCH",
    body: { ...rateBody(rate), reason, lock_version: rate.lock_version ?? 0 },
  });
  if (!result.ok) return rateFailure(result, "No pudimos guardar la tarifa.");
  revalidatePath("/catalogo/productos", "layout");
  return readEditor(code);
}

export async function removeProductRate(code: string, ref: string): Promise<WizardResult<ProductEditorState>> {
  const result = await apiFetch(`/catalog/products/${encodeURIComponent(code)}/rates/${encodeURIComponent(ref)}`, { method: "DELETE", body: {} });
  if (!result.ok) return failure(result, "No pudimos quitar la tarifa.");
  revalidatePath("/catalogo/productos", "layout");
  return readEditor(code);
}

export async function setProductRateActive(code: string, ref: string, active: boolean): Promise<WizardResult<ProductEditorState>> {
  const result = await apiFetch(`/catalog/products/${encodeURIComponent(code)}/rates/${encodeURIComponent(ref)}/${active ? "activate" : "deactivate"}`, {
    method: "POST",
    body: active ? {} : { reason: "Retirada desde el editor del producto" },
  });
  if (!result.ok) return failure(result, "No pudimos cambiar la tarifa.");
  revalidatePath("/catalogo/productos", "layout");
  return readEditor(code);
}

export async function publishProductChannel(code: string, channel: string, published: boolean): Promise<WizardResult<null>> {
  const result = await apiFetch(`/catalog/products/${encodeURIComponent(code)}/channels/${encodeURIComponent(channel)}`, { method: "PUT", body: { published } });
  if (!result.ok) return failure(result, "No pudimos cambiar el canal.");
  revalidatePath("/catalogo/productos", "layout");
  return { ok: true, data: null };
}
