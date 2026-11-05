import "server-only";
import type { Realm } from "@/lib/realms";
import { sessionToken } from "./session";

const API_URL = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: { code?: string; message: string; errors?: Record<string, string[]> } | null;
}

export async function apiFetch<T>(path: string, init: { method?: string; body?: unknown; token?: string | null; auth?: boolean; realm?: Realm; raw?: boolean } = {}): Promise<ApiResult<T>> {
  const token = init.token !== undefined ? init.token : init.auth === false ? null : await sessionToken(init.realm);
  const response = await fetch(`${API_URL}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });

  const payload = await response.json().catch(() => null);
  if (response.ok) return { ok: true, status: response.status, data: ((init.raw ? payload : payload?.data) ?? null) as T, error: null };

  return {
    ok: false,
    status: response.status,
    data: null,
    error: {
      code: payload?.code ?? payload?.error,
      message: payload?.message ?? "No pudimos conectar con el servidor. Inténtalo de nuevo en unos segundos.",
      errors: payload?.errors,
    },
  };
}

export function tenantSlugFrom(host: string | null): string | undefined {
  const domain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "localhost";
  const hostname = (host ?? "").split(":")[0];
  if (hostname.endsWith(`.${domain}`)) return hostname.slice(0, -(domain.length + 1)).split(".").pop();
  return process.env.DEFAULT_TENANT_SLUG || undefined;
}
