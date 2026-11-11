import { NextResponse, type NextRequest } from "next/server";
import { REALMS, realmFor } from "@/lib/realms";
import { FRAMEABLE_PREFIX, NONCE_HEADER, WIDGET_ASSETS_PREFIX, WIDGET_PREFIX, contentSecurityPolicy, createNonce } from "@/lib/security-headers";
import { widgetAncestors } from "@/lib/widget-ancestors";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith(WIDGET_ASSETS_PREFIX)) {
    const response = NextResponse.next();
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Cross-Origin-Resource-Policy", "cross-origin");
    return response;
  }
  const nonce = createNonce();
  const widget = pathname.startsWith(WIDGET_PREFIX);
  const ancestors = widget ? await widgetAncestors(request.nextUrl.searchParams.get("key"), request.headers.get("host")) : [];
  const policy = contentSecurityPolicy(nonce, widget || pathname.startsWith(FRAMEABLE_PREFIX), ancestors);
  const response = route(request, nonce, policy);
  response.headers.set("Content-Security-Policy", policy);
  return response;
}

function route(request: NextRequest, nonce: string, policy: string) {
  const { pathname, search } = request.nextUrl;
  const realm = REALMS[realmFor(pathname)];
  const hasSession = request.cookies.has(realm.session);
  const mfaPending = request.cookies.has(realm.mfa);
  const isPublic = pathname === "/" || realm.publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isEntry = pathname === realm.login || pathname === realm.mfaPage;

  if (!hasSession && !isPublic) {
    const url = new URL(realm.login, request.url);
    if (pathname !== "/" && pathname !== realm.home && pathname !== realm.mfaPage) url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (hasSession && mfaPending && pathname !== realm.mfaPage && pathname !== realm.logout) {
    return NextResponse.redirect(new URL(realm.mfaPage, request.url));
  }

  if (hasSession && !mfaPending && isEntry) {
    return NextResponse.redirect(new URL(realm.home, request.url));
  }

  const headers = new Headers(request.headers);
  headers.set(NONCE_HEADER, nonce);
  headers.set("Content-Security-Policy", policy);
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
