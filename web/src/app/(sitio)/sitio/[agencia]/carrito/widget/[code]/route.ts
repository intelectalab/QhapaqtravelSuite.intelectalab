import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { apiFetch } from "@/lib/server/api";
import { redirectTo } from "@/lib/server/redirect";
import { cartHeaders, siteBase, siteRequestHeaders } from "@/lib/server/site";
import { cartCookie, siteHref } from "@/lib/site";

const CART_DAYS = 30;

export async function GET(request: NextRequest, { params }: RouteContext<"/sitio/[agencia]/carrito/widget/[code]">) {
  const { agencia, code } = await params;
  const store = await cookies();
  const base = await siteBase(agencia);
  const result = /^WHO-\d+$/.test(code)
    ? await apiFetch<{ token: string }>("/public/carts", { method: "POST", auth: false, body: { handoff: code }, headers: await siteRequestHeaders(agencia, cartHeaders(store.get(cartCookie(agencia))?.value)) })
    : null;

  if (!result?.ok || !result.data) return redirectTo(request, siteHref(base, "/carrito"));

  store.set(cartCookie(agencia), result.data.token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: CART_DAYS * 86_400 });
  return redirectTo(request, siteHref(base, "/checkout"));
}
