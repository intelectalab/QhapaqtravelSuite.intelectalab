import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { ProductDetail, ProductFormOptions, ProductRow, ProductTranslations } from "@/lib/catalog";
import { REALMS } from "@/lib/realms";
import { apiFetch } from "./api";

async function get<T>(path: string): Promise<T | null> {
  const result = await apiFetch<T>(path);
  if (result.status === 401) redirect(REALMS.agency.logout);
  if (result.status === 403 && result.error?.code === "MFA_REQUIRED") redirect(REALMS.agency.mfaPage);
  if (result.status === 404) notFound();
  if (result.status === 403) return null;
  if (!result.ok || !result.data) throw new Error(result.error?.message ?? "No pudimos cargar el catálogo.");
  return result.data;
}

export const listProducts = async (): Promise<ProductRow[]> => (await get<ProductRow[]>("/catalog/products")) ?? [];

export const getProduct = cache(async (code: string): Promise<ProductDetail> => (await get<ProductDetail>(`/catalog/products/${encodeURIComponent(code)}`)) ?? notFound());

export const getProductFormOptions = cache(async (): Promise<ProductFormOptions | null> => get<ProductFormOptions>("/catalog/products/form-options"));

export const getProductTranslations = async (code: string): Promise<ProductTranslations | null> => get<ProductTranslations>(`/catalog/products/${encodeURIComponent(code)}/translations`);
