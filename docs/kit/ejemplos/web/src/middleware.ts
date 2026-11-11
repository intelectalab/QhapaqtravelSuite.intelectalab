/**
 * Middleware de Next.js por experiencia (CONVENCIONES §6; spec 00 SEC-BR-04/05; ROLE_UX).
 *
 *  - Sin sesión en ruta privada → /login?next=…
 *  - Usuario externo (cliente, pasajero, B2B, proveedor, guía/conductor) fuera de sus prefijos → su home.
 *  - Rol interno que entra a un árbol externo → /403 (las vistas previas internas de portales van por otra ruta, H-05).
 *  - `/` → home de la experiencia.
 * Es UX: lee la cookie `kipucontrol_ux` ({role, experience}) que fija el BFF al iniciar sesión con datos de /me/access.
 * Manipularla no da acceso a nada: la API valida token, permisos y alcance en cada solicitud.
 * Permiso por pantalla (ACCESS) se resuelve en el layout del back-office con /me/access → <Forbidden/> (403).
 */
import { NextResponse, type NextRequest } from "next/server";
import { canNavigate, PUBLIC_PREFIXES, startsWithAny, uxFor } from "@/lib/access/role-ux";
import { SESSION_COOKIE, UX_COOKIE } from "@/lib/api/client";

type UxCookie = { role?: string; experience?: string };

function readUx(req: NextRequest): UxCookie | null {
  const raw = req.cookies.get(UX_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(decodeURIComponent(raw)) as UxCookie;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest): NextResponse {
  const { pathname, search } = req.nextUrl;

  if (startsWithAny(pathname, PUBLIC_PREFIXES)) return NextResponse.next();

  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  const ux = readUx(req);
  if (!hasSession || !ux) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  const home = uxFor(ux.role).home;
  if (pathname === "/") return NextResponse.redirect(new URL(home, req.url));

  if (!canNavigate(ux.role, pathname)) {
    const external = uxFor(ux.role).experience !== "backoffice";
    // Externo fuera de su portal → a su home (spec 00 §7.7: «un cliente que abre otro portal es redirigido al suyo»).
    // Interno en árbol externo → 403 con la ruta pedida (pantalla Forbidden con «Solicitar acceso»).
    const url = new URL(external ? home : `/403?path=${encodeURIComponent(pathname)}`, req.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Excluye estáticos, imágenes, el BFF (lo valida la API) y archivos con extensión.
  matcher: ["/((?!_next/|bff/|favicon.ico|.*\\..*).*)"],
};
