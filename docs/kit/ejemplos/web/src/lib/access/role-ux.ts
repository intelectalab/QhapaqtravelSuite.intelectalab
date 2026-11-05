/**
 * Experiencia por rol — traducción a Next.js de ROLE_UX (proto/assets/js/core.js; spec 00 §7.4).
 * Solo UX: decide a qué home redirigir y qué árboles de rutas ver. La autorización real la hace la API
 * (`GET /api/v1/me/access` devuelve experience, home, routes, nav y screens con la misma regla).
 *
 * Rutas externas: se usan las de kit-ia/tests/e2e/support/routes.ts (`/portal-cliente`, `/portal-pasajero`, `/b2b`,
 * `/proveedor`, `/plataforma`). El CLAUDE.md de web propone `/portal/[clientCode]`, `/viaje`, `/agencias`:
 * POR DEFINIR — elegir una y cambiar solo este archivo y routes.ts.
 */

export type Experience = "backoffice" | "portal" | "mobile" | "platform";

export type RoleUx = {
  experience: Experience;
  label: string;
  home: string;
  /** Prefijos permitidos. `null` = back-office: la regla fina es ACCESS (permiso por pantalla) vía /me/access. */
  routes: readonly string[] | null;
};

const BACKOFFICE: RoleUx = { experience: "backoffice", label: "Back-office interno", home: "/dashboard", routes: null };

/** Roles semilla (spec 00 §7.2). Roles personalizados heredan por `scope` (tenant → back-office; mobile → operador). */
export const ROLE_UX: Record<string, RoleUx> = {
  super_admin: { experience: "platform", label: "Consola de plataforma", home: "/plataforma/tenants", routes: ["/plataforma"] },
  tenant_admin: BACKOFFICE,
  manager: BACKOFFICE,
  sales: BACKOFFICE,
  operations: BACKOFFICE,
  finance: BACKOFFICE,
  accounting: BACKOFFICE,
  guide: { experience: "mobile", label: "App del operador", home: "/app-operador", routes: ["/app-operador"] },
  driver: { experience: "mobile", label: "App del operador", home: "/app-operador", routes: ["/app-operador"] },
  passenger: {
    experience: "portal",
    label: "Portal del pasajero",
    home: "/portal-pasajero/viajes",
    routes: ["/portal-pasajero", "/libro-reclamaciones"],
  },
  b2b: { experience: "portal", label: "Portal de agencias", home: "/b2b/catalogo", routes: ["/b2b"] },
  customer: {
    experience: "portal",
    label: "Portal del cliente",
    home: "/portal-cliente/inicio",
    routes: ["/portal-cliente", "/libro-reclamaciones"],
  },
  provider: { experience: "portal", label: "Extranet de proveedores", home: "/proveedor/solicitudes", routes: ["/proveedor"] },
};

/** Prefijos de rutas de experiencias externas: un rol de back-office no navega dentro de ellas (vista previa = H-05). */
export const EXTERNAL_PREFIXES = ["/plataforma", "/app-operador", "/portal-pasajero", "/portal-cliente", "/b2b", "/proveedor"];

/** Rutas sin sesión: login, 403, sitio público, widget y checkout (tenant por host). */
export const PUBLIC_PREFIXES = ["/login", "/mfa", "/403", "/es", "/en", "/tours", "/widget", "/checkout", "/libro-reclamaciones"];

export function uxFor(role: string | undefined): RoleUx {
  return (role && ROLE_UX[role]) || BACKOFFICE; // rol desconocido → back-office con sus permisos (spec 00 §7.4)
}

export const startsWithAny = (path: string, prefixes: readonly string[]): boolean =>
  prefixes.some((p) => path === p || path.startsWith(p + "/"));

/** ¿Puede la experiencia del rol abrir esta ruta? (mismo criterio que `Access.check` pasos 2–3). */
export function canNavigate(role: string | undefined, path: string): boolean {
  const ux = uxFor(role);
  if (ux.routes) return startsWithAny(path, ux.routes);
  return !startsWithAny(path, EXTERNAL_PREFIXES);
}
