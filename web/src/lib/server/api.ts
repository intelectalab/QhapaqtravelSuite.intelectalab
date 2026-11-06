import "server-only";
import { createHash } from "node:crypto";
import { headers as requestHeaders } from "next/headers";
import type { Realm } from "@/lib/realms";
import { sessionToken } from "./session";

const API_URL = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

const IDEMPOTENCY_WINDOW_MS = 120_000;

const SUBJECT_HEADERS = ["x-cart-token", "x-order-token", "x-session-token"];

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T | null;
  error: { code?: string; message: string; errors?: Record<string, string[]>; details?: Record<string, unknown> } | null;
}

function headerValue(headers: Record<string, string>, name: string): string | undefined {
  const key = Object.keys(headers).find((candidate) => candidate.toLowerCase() === name);
  return key === undefined ? undefined : headers[key];
}

async function visitor(): Promise<string> {
  try {
    const incoming = await requestHeaders();
    return `${incoming.get("x-forwarded-for") ?? incoming.get("x-real-ip") ?? ""}|${incoming.get("user-agent") ?? ""}`;
  } catch {
    return "";
  }
}

async function writeHeaders(method: string, path: string, body: unknown, token: string | null, extra: Record<string, string>): Promise<Record<string, string>> {
  if (method === "GET") return {};
  const result: Record<string, string> = {};
  const lockVersion = body !== null && typeof body === "object" ? (body as Record<string, unknown>).lock_version : undefined;
  if (headerValue(extra, "if-match") === undefined && (typeof lockVersion === "number" || (typeof lockVersion === "string" && /^\d+$/.test(lockVersion)))) {
    result["If-Match"] = String(lockVersion);
  }
  if (!headerValue(extra, "idempotency-key")) {
    const subject = token ?? SUBJECT_HEADERS.map((name) => headerValue(extra, name)).find(Boolean) ?? (await visitor());
    const bucket = Math.floor(Date.now() / IDEMPOTENCY_WINDOW_MS);
    result["Idempotency-Key"] = createHash("sha256").update(`${subject}|${method}|${path}|${JSON.stringify(body ?? null)}|${bucket}`).digest("hex");
  }
  return result;
}

export async function apiFetch<T>(path: string, init: { method?: string; body?: unknown; token?: string | null; auth?: boolean; realm?: Realm; raw?: boolean; headers?: Record<string, string> } = {}): Promise<ApiResult<T>> {
  const token = init.token !== undefined ? init.token : init.auth === false ? null : await sessionToken(init.realm);
  const method = (init.method ?? "GET").toUpperCase();
  const extra = Object.fromEntries(Object.entries(init.headers ?? {}).filter(([, value]) => value !== ""));
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(await writeHeaders(method, path, init.body, token, extra)),
      ...extra,
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
      details: payload?.details,
    },
  };
}

export function tenantSlugFrom(host: string | null): string | undefined {
  const domain = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "localhost";
  const hostname = (host ?? "").split(":")[0];
  if (hostname.endsWith(`.${domain}`)) return hostname.slice(0, -(domain.length + 1)).split(".").pop();
  return undefined;
}
