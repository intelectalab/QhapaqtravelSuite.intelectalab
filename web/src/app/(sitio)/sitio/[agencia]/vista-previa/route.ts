import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { REALMS } from "@/lib/realms";
import { redirectTo } from "@/lib/server/redirect";
import { PREVIEW_COOKIE } from "@/lib/site-design";

const HOURS = 2;

export async function GET(request: NextRequest, { params }: RouteContext<"/sitio/[agencia]/vista-previa">) {
  const { agencia } = await params;
  const store = await cookies();
  const home = `/sitio/${agencia}`;

  if (request.nextUrl.searchParams.has("salir")) {
    store.delete(PREVIEW_COOKIE);
    return redirectTo(request, home);
  }

  if (!store.has(REALMS.agency.session)) {
    return redirectTo(request, `${REALMS.agency.login}?next=${encodeURIComponent("/admin/personalizacion?seccion=sitio-estilo")}`);
  }

  const wanted = request.nextUrl.searchParams.get("ruta") ?? home;
  const target = wanted === home || wanted.startsWith(`${home}/`) || wanted.startsWith(`${home}?`) ? wanted : home;
  store.set(PREVIEW_COOKIE, agencia, { httpOnly: true, sameSite: "strict", path: "/", maxAge: HOURS * 3600, secure: process.env.NODE_ENV === "production" });
  return redirectTo(request, target);
}
