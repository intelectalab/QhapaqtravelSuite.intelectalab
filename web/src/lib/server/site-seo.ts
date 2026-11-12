import { headers } from "next/headers";
import { SITE_LOCALES } from "@/lib/site-i18n";
import { siteBase } from "@/lib/server/site";

export const SITE_PRIVATE_PATHS = ["/carrito", "/checkout", "/confirmacion", "/cuenta", "/mi-viaje", "/vista-previa", "/resena", "/boletin"];

export async function siteOrigin(agencia: string): Promise<string> {
  const store = await headers();
  const host = store.get("x-forwarded-host") ?? store.get("host") ?? "localhost";
  const proto = store.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.includes(".localhost") ? "http" : "https");
  return `${proto}://${host}${await siteBase(agencia)}`;
}

export function localizedUrl(url: string, locale: string): string {
  return `${url}${url.includes("?") ? "&" : "?"}lang=${locale}`;
}

export function alternates(url: string): { locale: string; href: string }[] {
  return [...SITE_LOCALES.map((locale) => ({ locale, href: localizedUrl(url, locale) })), { locale: "x-default", href: url }];
}

const escapeXml = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function sitemapXml(entries: { url: string; lastmod?: string | null; priority?: number }[]): string {
  const body = entries
    .map((entry) => {
      const links = alternates(entry.url).map((alt) => `    <xhtml:link rel="alternate" hreflang="${alt.locale}" href="${escapeXml(alt.href)}"/>`).join("\n");
      const lastmod = entry.lastmod ? `\n    <lastmod>${entry.lastmod.slice(0, 10)}</lastmod>` : "";
      const priority = entry.priority !== undefined ? `\n    <priority>${entry.priority.toFixed(1)}</priority>` : "";
      return `  <url>\n    <loc>${escapeXml(entry.url)}</loc>${lastmod}${priority}\n${links}\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`;
}

export function jsonLd(data: Record<string, unknown> | Record<string, unknown>[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
