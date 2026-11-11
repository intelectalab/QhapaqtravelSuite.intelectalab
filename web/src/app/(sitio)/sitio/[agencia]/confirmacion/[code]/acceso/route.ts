import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { siteBase } from "@/lib/server/site";
import { orderCookie, siteHref } from "@/lib/site";

export async function GET(request: Request, { params }: RouteContext<"/sitio/[agencia]/confirmacion/[code]/acceso">) {
  const { agencia, code } = await params;
  const token = new URL(request.url).searchParams.get("token") ?? "";
  const base = await siteBase(agencia);

  if (!/^p\.\d{4}-\d{2}-\d{2}\.[a-f0-9]{64}$/.test(token)) return NextResponse.redirect(new URL(siteHref(base, "/cuenta/mi-reserva"), request.url));

  (await cookies()).set(orderCookie(code), token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 3 * 86_400 });
  return NextResponse.redirect(new URL(siteHref(base, `/confirmacion/${encodeURIComponent(code)}`), request.url));
}
