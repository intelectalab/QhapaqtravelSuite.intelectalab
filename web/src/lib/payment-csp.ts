import { parseGatewayInfo, type CspDirective } from "./payment-gateway";

const API_URL = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

const SITES_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "localhost";

const TTL_MS = 60_000;

const PAY_PAGES = "(checkout|confirmacion|pagar|regalo|cuenta/pagos)(/|$)";

const SITE_PATH = new RegExp(`^/sitio/([a-z0-9-]{2,40})/${PAY_PAGES}`);

const HOST_PATH = new RegExp(`^/${PAY_PAGES}`);

const PORTAL_PATH = /^\/portal\/pagos(\/|$)/;

export type PaymentSources = Partial<Record<CspDirective, string[]>>;

const cache = new Map<string, { at: number; sources: PaymentSources }>();

export function paymentTarget(pathname: string, host: string | null): { kind: "site"; host: string } | { kind: "portal" } | null {
  const site = SITE_PATH.exec(pathname);
  if (site) return { kind: "site", host: `${site[1]}.${SITES_DOMAIN}` };
  if (PORTAL_PATH.test(pathname)) return { kind: "portal" };
  const hostname = (host ?? "").split(",")[0].trim().split(":")[0].toLowerCase();
  if (HOST_PATH.test(pathname) && hostname !== "" && hostname !== "localhost" && hostname !== SITES_DOMAIN) return { kind: "site", host: hostname };
  return null;
}

export async function paymentSources(pathname: string, host: string | null, session: string | null): Promise<PaymentSources> {
  const target = paymentTarget(pathname, host);
  if (!target || (target.kind === "portal" && !session)) return {};
  const key = target.kind === "site" ? `site:${target.host}` : `portal:${session?.slice(-24)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.sources;
  let sources: PaymentSources = {};
  try {
    const response = await fetch(`${API_URL}${target.kind === "site" ? "/public/payment-gateway" : "/portal/client/payment-gateway"}`, {
      headers: { Accept: "application/json", ...(target.kind === "site" ? { "X-Forwarded-Host": target.host } : { Authorization: `Bearer ${session}` }) },
      cache: "no-store",
    });
    const info = parseGatewayInfo(response.ok ? (await response.json())?.data : null);
    sources = info.embedded ? (info.sources ?? {}) : {};
  } catch {
    sources = {};
  }
  if (cache.size > 500) cache.clear();
  cache.set(key, { at: Date.now(), sources });
  return sources;
}
