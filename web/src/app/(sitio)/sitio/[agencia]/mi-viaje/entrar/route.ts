import { NextResponse } from "next/server";
import { apiFetch } from "@/lib/server/api";
import { startSession } from "@/lib/server/session";
import { siteBase, siteRequestHeaders } from "@/lib/server/site";
import { siteHref } from "@/lib/site";

export async function GET(request: Request, { params }: RouteContext<"/sitio/[agencia]/mi-viaje/entrar">) {
  const { agencia } = await params;
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const base = await siteBase(agencia);
  const result = token.length === 48 ? await apiFetch<{ token: string; home: string }>("/portal/passenger/auth/verify", { method: "POST", auth: false, body: { token }, headers: await siteRequestHeaders(agencia) }) : null;

  if (!result?.ok || !result.data) return NextResponse.redirect(new URL(siteHref(base, "/mi-viaje?vencido=1"), request.url));

  await startSession(result.data.token, false);
  return NextResponse.redirect(new URL(result.data.home, request.url));
}
