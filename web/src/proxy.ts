import { NextResponse, type NextRequest } from "next/server";
import { REALMS, realmFor } from "@/lib/realms";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const realm = REALMS[realmFor(pathname)];
  const hasSession = request.cookies.has(realm.session);
  const mfaPending = request.cookies.has(realm.mfa);
  const isPublic = realm.publicPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
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

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
