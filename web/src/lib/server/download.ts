import "server-only";
import { sessionToken } from "./session";

const API_URL = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

const FALLBACK = "No pudimos generar el documento. Inténtalo de nuevo en unos segundos.";

interface PdfInit {
  auth?: boolean;
  headers?: Record<string, string>;
  method?: "GET" | "POST";
}

export function downloadError(message: string, status: number): Response {
  return Response.json({ message }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function redirectToDocument(path: string): Promise<Response> {
  const token = await sessionToken();
  if (!token) return downloadError("Tu sesión venció. Vuelve a ingresar para descargar el documento.", 401);
  const upstream = await fetch(`${API_URL}${path}`, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` }, cache: "no-store", redirect: "manual" }).catch(() => null);
  if (upstream === null) return downloadError("No pudimos conectar con el servidor. Inténtalo de nuevo en unos segundos.", 502);
  const location = upstream.headers.get("location");
  if (upstream.status >= 300 && upstream.status < 400 && location) return new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "private, no-store" } });
  const payload = await upstream.json().catch(() => null);
  return downloadError(payload?.message ?? FALLBACK, upstream.ok ? 502 : upstream.status);
}

export async function proxyPdf(path: string, init: PdfInit = {}): Promise<Response> {
  const token = init.auth === false ? null : await sessionToken();
  if (init.auth !== false && !token) return downloadError("Tu sesión venció. Vuelve a ingresar para descargar el documento.", 401);

  const upstream = await fetch(`${API_URL}${path}`, {
    method: init.method ?? "GET",
    headers: { Accept: "application/pdf", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.method === "POST" ? { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() } : {}), ...init.headers },
    ...(init.method === "POST" ? { body: "{}" } : {}),
    cache: "no-store",
  }).catch(() => null);

  if (upstream === null) return downloadError("No pudimos conectar con el servidor. Inténtalo de nuevo en unos segundos.", 502);

  if (upstream.ok && upstream.body && (upstream.headers.get("content-type") ?? "").startsWith("application/pdf")) {
    const headers = new Headers({ "Content-Type": "application/pdf", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
    for (const name of ["content-length", "content-disposition"]) {
      const value = upstream.headers.get(name);
      if (value) headers.set(name, value);
    }
    return new Response(upstream.body, { status: 200, headers });
  }

  const payload = await upstream.json().catch(() => null);
  return downloadError(payload?.message ?? FALLBACK, upstream.ok ? 502 : upstream.status);
}
