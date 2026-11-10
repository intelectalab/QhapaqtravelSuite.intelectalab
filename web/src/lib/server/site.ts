import "server-only";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import type { DestinationCard, DestinationDetail, FormOptions, HomeData, ListingData, ListingKey, ProductDetail, SiteProfile } from "@/lib/site";
import { cartCookie, listingQuery, orderCookie, type SiteCart, type SiteOrder } from "@/lib/site";
import { parseSiteLocale, SITE_LOCALE_COOKIE, type SiteLocale } from "@/lib/site-i18n";
import { apiFetch, tenantSlugFrom } from "./api";

const SITES_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "localhost";

const CART_COOKIE = "ah_cart";

function sitePath(path: string): string {
  return `/public${path}`;
}

export function cartHeaders(token: string | undefined): Record<string, string> {
  return token ? { Cookie: `${CART_COOKIE}=${encodeURIComponent(token)}` } : {};
}

export const siteLocale = cache(async (): Promise<SiteLocale> => parseSiteLocale((await cookies()).get(SITE_LOCALE_COOKIE)?.value));

async function siteHeaders(agencia: string, extra: Record<string, string> = {}): Promise<Record<string, string>> {
  return { "X-Forwarded-Host": `${agencia}.${SITES_DOMAIN}`, "X-Site-Locale": await siteLocale(), ...extra };
}

export const siteRequestHeaders = siteHeaders;

async function read<T>(agencia: string, path: string, extra: Record<string, string> = {}): Promise<T> {
  const result = await apiFetch<T>(sitePath(path), { auth: false, headers: await siteHeaders(agencia, extra) });
  if (result.status === 404) notFound();
  if (!result.ok || result.data === null) throw new Error(result.error?.message ?? "No pudimos cargar el sitio.");
  return result.data;
}

export const siteBase = cache(async (agencia: string): Promise<string> => {
  const host = (await headers()).get("host");
  return tenantSlugFrom(host) === agencia ? "" : `/sitio/${agencia}`;
});

export const getSiteProfile = cache((agencia: string) => read<SiteProfile>(agencia, "/site"));

export const getSiteHome = cache((agencia: string) => read<HomeData>(agencia, "/home"));

export const getSiteDestinations = cache((agencia: string) => read<{ items: DestinationCard[] }>(agencia, "/destinations"));

export const getSiteDestination = cache((agencia: string, slug: string) => read<DestinationDetail>(agencia, `/destinations/${encodeURIComponent(slug)}`));

export const getSiteListing = cache(async (agencia: string, params: Partial<Record<ListingKey, string>>): Promise<ListingData & { invalid: boolean }> => {
  const result = await apiFetch<ListingData>(sitePath(`/products${listingQuery(params)}`), { auth: false, headers: await siteHeaders(agencia) });
  if (result.ok && result.data) return { ...result.data, invalid: false };
  if (result.status === 422) return { ...(await read<ListingData>(agencia, "/products")), invalid: true };
  return { ...(await read<ListingData>(agencia, `/products${listingQuery(params)}`)), invalid: false };
});

export const getSiteProduct = cache((agencia: string, slug: string, viajeros = 2) => read<ProductDetail>(agencia, `/products/${encodeURIComponent(slug)}?viajeros=${viajeros}`));

export const getSiteFormOptions = cache((agencia: string) => read<FormOptions>(agencia, "/form-options"));

export async function sendSite<T>(agencia: string, path: string, body: Record<string, unknown>, extra: Record<string, string> = {}, method = "POST") {
  return apiFetch<T>(sitePath(path), { method, body, auth: false, headers: await siteHeaders(agencia, extra) });
}

export async function readSite<T>(agencia: string, path: string, extra: Record<string, string> = {}) {
  return apiFetch<T>(sitePath(path), { auth: false, headers: await siteHeaders(agencia, extra) });
}

export async function getSiteCart(agencia: string): Promise<SiteCart> {
  const token = (await cookies()).get(cartCookie(agencia))?.value;
  const result = await readSite<SiteCart>(agencia, "/carts/current", cartHeaders(token));
  return result.ok && result.data ? result.data : { code: null, promo: null, items: [], totals: [], hold_minutes: 30, fx: 0 };
}

export async function getSiteOrder(agencia: string, code: string): Promise<SiteOrder> {
  const token = (await cookies()).get(orderCookie(code))?.value;
  if (!token) notFound();
  return read<SiteOrder>(agencia, `/orders/${encodeURIComponent(code)}`, { "X-Order-Token": token });
}
