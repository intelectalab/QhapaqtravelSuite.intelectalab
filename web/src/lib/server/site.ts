import "server-only";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import type { AboutData, CheckoutTerms, DestinationCard, DestinationDetail, FormOptions, HomeData, ListingData, ListingKey, OffersData, PostDetail, PostSummary, ProductDetail, SitePage, SiteProfile } from "@/lib/site";
import { accountCookie, cartCookie, listingQuery, orderCookie, siteHref, type SiteCart, type SiteOrder } from "@/lib/site";
import { REALMS } from "@/lib/realms";
import { PREVIEW_COOKIE, withTextOverrides, type SitePreview } from "@/lib/site-design";
import { parseSiteLocale, SITE_LOCALE_COOKIE, siteText, type SiteLocale, type SiteText } from "@/lib/site-i18n";
import { TEMPLATE_PREVIEW_COOKIE, templatePreviewToken, type PublicSiteTheme } from "@/lib/templatePreview";
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

export const getSitePreview = cache(async (agencia: string): Promise<SitePreview | null> => {
  const store = await cookies();
  if (store.get(PREVIEW_COOKIE)?.value !== agencia || !store.has(REALMS.agency.session)) return null;
  const result = await apiFetch<SitePreview>("/admin/site-design/preview");
  return result.ok && result.data && result.data.subdomain === agencia ? result.data : null;
});

export const getTemplatePreview = cache(async (agencia: string): Promise<PublicSiteTheme | null> => {
  const token = templatePreviewToken((await cookies()).get(TEMPLATE_PREVIEW_COOKIE)?.value);
  if (!token) return null;
  const result = await apiFetch<PublicSiteTheme>(sitePath(`/site/theme?preview=${encodeURIComponent(token)}`), { auth: false, headers: await siteHeaders(agencia) });
  return result.ok && result.data?.preview && result.data.site_style ? result.data : null;
});

export const getSiteProfile = cache(async (agencia: string): Promise<SiteProfile> => {
  const [profile, preview, template] = await Promise.all([read<SiteProfile>(agencia, "/site"), getSitePreview(agencia), getTemplatePreview(agencia)]);
  const current = preview ? { ...profile, design: preview.design, branding: preview.branding, banner: preview.banner, preview: true } : profile;
  if (!template?.template || !template.site_style) return current;
  return { ...current, design: { ...current.design, theme: { ...current.design.theme, style: template.site_style } }, templatePreview: { code: template.template.code, name: template.template.name, version: template.version } };
});

export const getSiteText = cache(async (agencia: string): Promise<SiteText> => {
  const [profile, locale] = await Promise.all([getSiteProfile(agencia), siteLocale()]);
  return withTextOverrides(siteText(locale), profile.design.texts[locale], profile.agency.name);
});

export const getSiteHome = cache((agencia: string) => read<HomeData>(agencia, "/home"));

export const getSiteOffers = cache((agencia: string) => read<OffersData>(agencia, "/offers"));

export const getSitePosts = cache((agencia: string) => read<PostSummary[]>(agencia, "/posts"));

export const getSitePost = cache((agencia: string, slug: string) => read<PostDetail>(agencia, `/posts/${encodeURIComponent(slug)}`));

export const getSitePage = cache((agencia: string, slug: string) => read<SitePage>(agencia, `/pages/${encodeURIComponent(slug)}`));

export const getSiteAbout = cache((agencia: string) => read<AboutData>(agencia, "/pages/nosotros"));

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

export async function getCheckoutTerms(agencia: string): Promise<CheckoutTerms | null> {
  const token = (await cookies()).get(cartCookie(agencia))?.value;
  if (!token) return null;
  const result = await sendSite<{ terms: CheckoutTerms }>(agencia, "/checkout/validate", {}, cartHeaders(token));
  return result.ok && result.data ? result.data.terms : null;
}

export async function getSiteOrder(agencia: string, code: string): Promise<SiteOrder> {
  const token = (await cookies()).get(orderCookie(code))?.value;
  if (!token) notFound();
  return read<SiteOrder>(agencia, `/orders/${encodeURIComponent(code)}`, { "X-Order-Token": token });
}

export async function accountToken(agencia: string): Promise<string | null> {
  return (await cookies()).get(accountCookie(agencia))?.value ?? null;
}

export async function accountFetch<T>(agencia: string, path: string, init: { method?: string; body?: unknown } = {}) {
  const token = await accountToken(agencia);
  return apiFetch<T>(sitePath(path), { ...init, token, headers: await siteHeaders(agencia) });
}

export async function requireAccount<T>(agencia: string, path: string): Promise<T> {
  const token = await accountToken(agencia);
  const base = await siteBase(agencia);
  if (!token) redirect(siteHref(base, "/cuenta/ingresar"));
  const result = await apiFetch<T>(sitePath(path), { token, headers: await siteHeaders(agencia) });
  if (result.status === 401 || result.status === 403) redirect(siteHref(base, "/cuenta/ingresar?vencida=1"));
  if (result.status === 404) notFound();
  if (!result.ok || result.data === null) throw new Error(result.error?.message ?? "No pudimos cargar tu cuenta.");
  return result.data;
}
