/**
 * BFF (Backend For Frontend): proxy de /bff/api/v1/* → API Laravel, agregando el token Sanctum de la cookie
 * httpOnly. El navegador nunca ve el token (protección frente a XSS que robe sesiones).
 *
 * - Reenvía método, cuerpo y SOLO los headers permitidos (Idempotency-Key, If-Match, X-Request-Id, Accept-Language).
 * - Solo rutas /api/v1/*; cualquier otra → 404 (no es un proxy abierto: evita SSRF).
 * - CSRF: el BFF solo acepta solicitudes del mismo origen (header Origin = host) en métodos que escriben.
 * - Los Server Components NO pasan por aquí: usan serverApi() directo a la API interna.
 */
import { cookies, headers } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/api/client";

const FORWARD_REQUEST_HEADERS = ["content-type", "accept", "accept-language", "idempotency-key", "if-match", "x-request-id"];
const FORWARD_RESPONSE_HEADERS = ["content-type", "etag", "x-request-id", "retry-after", "idempotent-replayed", "content-disposition"];

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }): Promise<Response> {
  const { path } = await ctx.params;
  if (path[0] !== "api" || path[1] !== "v1") return NextResponse.json({ error: "RESOURCE_NOT_FOUND" }, { status: 404 });

  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin");
    const host = (await headers()).get("host");
    if (origin && host && new URL(origin).host !== host) {
      return NextResponse.json({ error: "FORBIDDEN", message: "Origen no permitido." }, { status: 403 });
    }
  }

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const target = new URL(`/${path.join("/")}${req.nextUrl.search}`, process.env.API_INTERNAL_URL ?? "http://localhost:8000");

  const forward = new Headers();
  for (const h of FORWARD_REQUEST_HEADERS) {
    const v = req.headers.get(h);
    if (v) forward.set(h, v);
  }
  if (token) forward.set("Authorization", `Bearer ${token}`);
  forward.set("X-Forwarded-Host", req.headers.get("host") ?? ""); // el backend contrasta host ↔ token (SEC-BR-02)

  const res = await fetch(target, {
    method: req.method,
    headers: forward,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
    cache: "no-store",
    redirect: "manual",
  });

  const out = new Headers();
  for (const h of FORWARD_RESPONSE_HEADERS) {
    const v = res.headers.get(h);
    if (v) out.set(h, v);
  }
  return new Response(res.body, { status: res.status, headers: out });
}

export { proxy as GET, proxy as POST, proxy as PUT, proxy as PATCH, proxy as DELETE };
