import { NextResponse, type NextRequest } from "next/server";
import { AGENCY_PREVIEW_RETURN, PREVIEW_BACK_COOKIE, previewBack } from "@/lib/agency-preview";
import { REALMS, realmFor } from "@/lib/realms";
import { SITE_LOCALE_COOKIE, SITE_LOCALES } from "@/lib/site-i18n";
import { TEMPLATE_PREVIEW_COOKIE, TEMPLATE_PREVIEW_SECONDS, templatePreviewToken } from "@/lib/templatePreview";
import { FRAMEABLE_PREFIX, HSTS_HEADER, NONCE_HEADER, WIDGET_ASSETS_PREFIX, WIDGET_PREFIX, contentSecurityPolicy, createNonce, isSecureRequest } from "@/lib/security-headers";
import { showcasePath } from "@/lib/showcase-host";
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
  const secure = isSecureRequest(request.headers.get("x-forwarded-proto"), request.nextUrl.protocol);
  const policy = contentSecurityPolicy(nonce, widget || pathname.startsWith(FRAMEABLE_PREFIX), ancestors, secure);
  const response = route(request, nonce, policy);
  response.headers.set("Content-Security-Policy", policy);
  if (secure) response.headers.set(HSTS_HEADER.key, HSTS_HEADER.value);
  return response;
}

function route(request: NextRequest, nonce: string, policy: string) {
  const { pathname, search } = request.nextUrl;
  const showcase = showcasePath(request.headers.get("x-forwarded-host") ?? request.headers.get("host"), pathname);
  if (showcase) {
    const forwarded = new Headers(request.headers);
    forwarded.set(NONCE_HEADER, nonce);
    forwarded.set("Content-Security-Policy", policy);
    return NextResponse.rewrite(new URL(`${showcase}${search}`, request.url), { request: { headers: forwarded } });
  }
  const realm = REALMS[realmFor(pathname)];
  const hasSession = request.cookies.has(realm.session);
  const mfaPending = request.cookies.has(realm.mfa);
  const isPublic = pathname === "/" || realm.publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  const isEntry = pathname === realm.login || pathname === realm.mfaPage;

  const previewReturn = realm === REALMS.agency ? request.cookies.get(AGENCY_PREVIEW_RETURN)?.value : undefined;
  if (!hasSession && previewReturn) {
    const restored = NextResponse.redirect(new URL(previewBack(request.cookies.get(PREVIEW_BACK_COOKIE)?.value), request.url));
    restored.cookies.delete({ name: AGENCY_PREVIEW_RETURN, path: "/" });
    restored.cookies.delete({ name: PREVIEW_BACK_COOKIE, path: "/" });
    restored.cookies.set(realm.session, previewReturn, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: realm.path, maxAge: 60 * 60 * realm.hours });
    return restored;
  }

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

  const lang = request.nextUrl.searchParams.get("lang");
  const locale = pathname.startsWith("/sitio/") && lang && (SITE_LOCALES as string[]).includes(lang) ? lang : null;
  if (locale) request.cookies.set(SITE_LOCALE_COOKIE, locale);
  const preview = pathname.startsWith("/sitio/") ? templatePreviewToken(request.nextUrl.searchParams.get("preview")) : null;
  if (preview) request.cookies.set(TEMPLATE_PREVIEW_COOKIE, preview);
  const headers = new Headers(request.headers);
  headers.set(NONCE_HEADER, nonce);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  if (locale) response.cookies.set(SITE_LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  if (preview) response.cookies.set(TEMPLATE_PREVIEW_COOKIE, preview, { path: "/", maxAge: TEMPLATE_PREVIEW_SECONDS, sameSite: "lax", httpOnly: true });
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
