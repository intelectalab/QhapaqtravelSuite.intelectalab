import "server-only";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { DestinationCard, DestinationDetail, FormOptions, HomeData, ListingData, ListingKey, ProductDetail, SiteProfile } from "@/lib/site";
import { cartCookie, listingQuery, orderCookie, type SiteCart, type SiteOrder } from "@/lib/site";
import { apiFetch, tenantSlugFrom } from "./api";

function sitePath(agencia: string, path = ""): string {
  return `/public/sites/${encodeURIComponent(agencia)}${path}`;
}

async function read<T>(agencia: string, path: string, extra: Record<string, string> = {}): Promise<T> {
  const result = await apiFetch<T>(sitePath(agencia, path), { auth: false, headers: extra });
  if (result.status === 404) notFound();
  if (!result.ok || result.data === null) throw new Error(result.error?.message ?? "No pudimos cargar el sitio.");
  return result.data;
}

export const siteBase = cache(async (agencia: string): Promise<string> => {
  const host = (await headers()).get("host");
  return tenantSlugFrom(host) === agencia ? "" : `/sitio/${agencia}`;
});

export const getSiteProfile = cache((agencia: string) => read<SiteProfile>(agencia, ""));

export const getSiteHome = cache((agencia: string) => read<HomeData>(agencia, "/home"));

export const getSiteDestinations = cache((agencia: string) => read<{ items: DestinationCard[] }>(agencia, "/destinations"));

export const getSiteDestination = cache((agencia: string, slug: string) => read<DestinationDetail>(agencia, `/destinations/${encodeURIComponent(slug)}`));

export const getSiteListing = cache(async (agencia: string, params: Partial<Record<ListingKey, string>>): Promise<ListingData & { invalid: boolean }> => {
  const result = await apiFetch<ListingData>(sitePath(agencia, `/products${listingQuery(params)}`), { auth: false });
  if (result.ok && result.data) return { ...result.data, invalid: false };
  if (result.status === 422) return { ...(await read<ListingData>(agencia, "/products")), invalid: true };
  return { ...(await read<ListingData>(agencia, `/products${listingQuery(params)}`)), invalid: false };
});

export const getSiteProduct = cache((agencia: string, slug: string, viajeros = 2) => read<ProductDetail>(agencia, `/products/${encodeURIComponent(slug)}?viajeros=${viajeros}`));

export const getSiteFormOptions = cache((agencia: string) => read<FormOptions>(agencia, "/form-options"));

export async function sendSite<T>(agencia: string, path: string, body: Record<string, unknown>, extra: Record<string, string> = {}, method = "POST") {
  return apiFetch<T>(sitePath(agencia, path), { method, body, auth: false, headers: extra });
}

export async function readSite<T>(agencia: string, path: string, extra: Record<string, string> = {}) {
  return apiFetch<T>(sitePath(agencia, path), { auth: false, headers: extra });
}

export async function getSiteCart(agencia: string): Promise<SiteCart> {
  const token = (await cookies()).get(cartCookie(agencia))?.value;
  const result = await readSite<SiteCart>(agencia, "/cart", token ? { "X-Cart-Token": token } : {});
  return result.ok && result.data ? result.data : { code: null, promo: null, items: [], totals: [], hold_minutes: 30, fx: 0 };
}

export async function getSiteOrder(agencia: string, code: string): Promise<SiteOrder> {
  const token = (await cookies()).get(orderCookie(code))?.value;
  if (!token) notFound();
  return read<SiteOrder>(agencia, `/orders/${encodeURIComponent(code)}`, { "X-Order-Token": token });
}
