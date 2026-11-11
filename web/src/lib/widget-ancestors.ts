const API_URL = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

const TTL_MS = 5 * 60_000;

const cache = new Map<string, { at: number; ancestors: string[] }>();

export async function widgetAncestors(key: string | null, host: string | null): Promise<string[]> {
  const id = key ?? `host:${host ?? ""}`;
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.ancestors;
  let ancestors: string[] = [];
  try {
    const response = await fetch(`${API_URL}/public/widget/config`, { headers: { Accept: "application/json", ...(key ? { "X-KipuControl-Key": key } : host ? { "X-Forwarded-Host": host } : {}) }, cache: "no-store" });
    const payload = response.ok ? await response.json() : null;
    const domains: unknown = payload?.data?.domains;
    ancestors = Array.isArray(domains) ? domains.filter((domain): domain is string => typeof domain === "string" && /^[a-z0-9.-]+$/i.test(domain)).map((domain) => `https://${domain}`) : [];
  } catch {
    ancestors = [];
  }
  if (cache.size > 500) cache.clear();
  cache.set(id, { at: Date.now(), ancestors });
  return ancestors;
}
