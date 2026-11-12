import * as SecureStore from "expo-secure-store";
import { API_URL } from "../config";
import type { ApiError } from "../types";

const TOKEN_KEY = "kipucontrol.operador.token";

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string | null): Promise<void> {
  if (token === null) await SecureStore.deleteItemAsync(TOKEN_KEY);
  else await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export class ApiRequestError extends Error {
  constructor(readonly detail: ApiError) {
    super(detail.message);
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | string[] | undefined>;
  idempotencyKey?: string;
  auth?: boolean;
  headers?: Record<string, string>;
}

function buildQuery(query: RequestOptions["query"]): string {
  if (!query) return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) parts.push(`${encodeURIComponent(Array.isArray(value) ? `${key}[]` : key)}=${encodeURIComponent(item)}`);
  }
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json", ...options.headers };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  if (options.auth !== false) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}${buildQuery(options.query)}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiRequestError({ status: 0, message: "Sin conexión con el servidor." });
  }

  const payload = (await response.json().catch(() => ({}))) as { data?: T; message?: string; error?: string; code?: string; errors?: Record<string, string[]> };
  if (!response.ok) {
    const firstError = payload.errors ? Object.values(payload.errors)[0]?.[0] : undefined;
    throw new ApiRequestError({ status: response.status, error: payload.error, code: payload.code, errors: payload.errors, message: firstError ?? payload.message ?? `Error ${response.status}` });
  }
  return payload.data as T;
}
