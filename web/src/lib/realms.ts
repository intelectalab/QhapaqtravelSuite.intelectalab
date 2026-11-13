export type Realm = "agency" | "platform";

interface RealmConfig {
  session: string;
  mfa: string;
  path: string;
  hours: number;
  login: string;
  mfaPage: string;
  logout: string;
  home: string;
  publicPaths: string[];
}

export const REALMS: Record<Realm, RealmConfig> = {
  agency: {
    session: "kipucontrol_session",
    mfa: "kipucontrol_mfa_pending",
    path: "/",
    hours: 12,
    login: "/login",
    mfaPage: "/mfa",
    logout: "/salir",
    home: "/dashboard",
    publicPaths: ["/login", "/salir", "/invitacion", "/recuperar", "/restablecer", "/sitio", "/software", "/widget", "/c", "/robots.txt", "/vitrina"],
  },
  platform: {
    session: "kipucontrol_platform_session",
    mfa: "kipucontrol_platform_mfa",
    path: "/plataforma",
    hours: 8,
    login: "/login",
    mfaPage: "/plataforma/verificar",
    logout: "/plataforma/salir",
    home: "/plataforma/inicio",
    publicPaths: ["/plataforma/salir"],
  },
};

export function realmFor(pathname: string): Realm {
  return pathname === "/plataforma" || pathname.startsWith("/plataforma/") ? "platform" : "agency";
}
