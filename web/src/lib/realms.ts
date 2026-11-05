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
    session: "qhapaq_session",
    mfa: "qhapaq_mfa_pending",
    path: "/",
    hours: 12,
    login: "/login",
    mfaPage: "/mfa",
    logout: "/salir",
    home: "/dashboard",
    publicPaths: ["/login", "/salir"],
  },
  platform: {
    session: "qhapaq_platform_session",
    mfa: "qhapaq_platform_mfa",
    path: "/plataforma",
    hours: 8,
    login: "/login",
    mfaPage: "/plataforma/verificar",
    logout: "/plataforma/salir",
    home: "/plataforma/agencias",
    publicPaths: ["/plataforma/salir"],
  },
};

export function realmFor(pathname: string): Realm {
  return pathname === "/plataforma" || pathname.startsWith("/plataforma/") ? "platform" : "agency";
}
