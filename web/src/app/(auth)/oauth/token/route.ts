import type { NextRequest } from "next/server";

const API_URL = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<Response> {
  const forwarded = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip");
  const authorization = request.headers.get("authorization");
  const response = await fetch(`${API_URL}/oauth/token`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": request.headers.get("content-type") ?? "application/x-www-form-urlencoded",
      ...(authorization ? { Authorization: authorization } : {}),
      ...(forwarded ? { "X-Forwarded-For": forwarded } : {}),
    },
    body: await request.text(),
    cache: "no-store",
  });

  return new Response(await response.text(), {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("content-type") ?? "application/json",
      "Cache-Control": "no-store",
      Pragma: "no-cache",
      ...(response.headers.get("www-authenticate") ? { "WWW-Authenticate": response.headers.get("www-authenticate") as string } : {}),
    },
  });
}
