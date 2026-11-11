import type { CSSProperties } from "react";
import type { AuditEntry } from "@/lib/admin";
import type { SiteLocale, SiteText } from "@/lib/site-i18n";

export type SiteFont = "moderna" | "clasica" | "redondeada" | "editorial";
export type SiteCorners = "suaves" | "rectas" | "redondeadas";

export type SiteStyle = "actual" | "andes";
export type SiteSectionId = "destinations" | "featured" | "promos" | "offers" | "departures" | "reasons" | "reviews" | "newsletter";
export type SiteNavLinkId = "destinations" | "tours" | "packages" | "experiences" | "transfers" | "offers" | "tailored" | "contact";
export type SiteSocial = "facebook" | "instagram" | "tiktok" | "youtube" | "whatsapp";
export type PromoTone = "marca" | "acento" | "menu";

export interface SitePromo {
  id: string;
  title: string;
  body: string;
  image_id: string | null;
  cta_label: string;
  cta_href: string;
  tone: PromoTone;
  starts_on: string | null;
  ends_on: string | null;
  visible: boolean;
}

export interface SiteDesign {
  theme: { colors: "panel" | "propios"; brand: string; accent: string; menu: string; font: SiteFont; corners: SiteCorners; style: SiteStyle };
  hero: { style: "noche" | "color" | "imagen"; image_id: string | null; overlay: number; align: "izquierda" | "centro"; show_search: boolean; show_stats: boolean };
  sections: { id: SiteSectionId; visible: boolean }[];
  announcement: { mode: "cms" | "propio" | "oculto"; text: string; link_label: string; link_href: string };
  promos: SitePromo[];
  nav: { links: { id: SiteNavLinkId; visible: boolean }[]; show_locale: boolean; show_theme: boolean; show_cart: boolean; show_quote: boolean };
  footer: { show_sedes: boolean; show_fx: boolean; social: Record<SiteSocial, string> };
  seo: { title: string; description: string };
  texts: Partial<Record<SiteLocale, Record<string, string>>>;
}

export interface SiteBannerData {
  title: string;
  body: string | null;
  link_label: string | null;
  link_href: string | null;
}

export interface SiteImage {
  id: string;
  name: string;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  uploaded_at: string;
}

export interface SiteVersion {
  version: number;
  note: string | null;
  by: string | null;
  at: string;
}

interface Option<T extends string = string> {
  value: T;
  label: string;
}

export interface SiteDesignCatalog {
  fonts: Option<SiteFont>[];
  corners: Option<SiteCorners>[];
  styles: Option<SiteStyle>[];
  color_sources: Option<SiteDesign["theme"]["colors"]>[];
  hero_styles: Option<SiteDesign["hero"]["style"]>[];
  hero_align: Option<SiteDesign["hero"]["align"]>[];
  announcement_modes: Option<SiteDesign["announcement"]["mode"]>[];
  promo_tones: Option<PromoTone>[];
  sections: Option<SiteSectionId>[];
  nav_links: Option<SiteNavLinkId>[];
  social: Option<SiteSocial>[];
  texts: { key: string; max: number }[];
  max_promos: number;
}

export interface SiteDesignOverview {
  draft: SiteDesign;
  published: SiteDesign | null;
  pending: string[];
  lock_version: number;
  published_version: number;
  published_at: string | null;
  draft_updated_at: string | null;
  panel_colors: { brand: string; accent: string; menu: string };
  site: { subdomain: string; name: string };
  images: SiteImage[];
  versions: SiteVersion[];
  catalog: SiteDesignCatalog;
  history: AuditEntry[];
  can_manage: boolean;
}

export interface SitePreview {
  subdomain: string;
  design: SiteDesign;
  branding: { brand: string; accent: string; menu: string };
  banner: SiteBannerData | null;
}

export const PREVIEW_COOKIE = "qts_site_preview";

export const PREVIEW_MESSAGE = "qts-site-preview";

export const AGENCY_TOKEN = "{agencia}";

export const FONT_STACK: Record<SiteFont, string> = {
  moderna: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
  clasica: "var(--font-site-lora), Georgia, serif",
  redondeada: "var(--font-site-nunito), ui-rounded, system-ui, sans-serif",
  editorial: "var(--font-site-fraunces), Georgia, serif",
};

export const ANDES_SERIF = "var(--font-site-noto-serif), Georgia, serif";

export const CORNER_RADII: Record<SiteCorners, { card: string; tile: string; control: string }> = {
  suaves: { card: "20px", tile: "16px", control: "12px" },
  rectas: { card: "6px", tile: "6px", control: "4px" },
  redondeadas: { card: "30px", tile: "24px", control: "999px" },
};

export interface SiteThemeVars {
  brand: string;
  accent: string;
  menu: string;
  font: SiteFont;
  corners: SiteCorners;
}

export function siteThemeStyle(theme: SiteThemeVars): CSSProperties {
  const radii = CORNER_RADII[theme.corners];
  return {
    "--brand": theme.brand,
    "--site-accent": theme.accent,
    "--menu": theme.menu,
    "--t1": theme.accent,
    "--radius-card": radii.card,
    "--radius-tile": radii.tile,
    "--radius-control": radii.control,
    fontFamily: FONT_STACK[theme.font],
  } as CSSProperties;
}

export function siteImageHref(base: string, id: string): string {
  return `${base || ""}/imagen/${id}`;
}

function fill(value: string, name: string): string {
  return value.split(AGENCY_TOKEN).join(name);
}

export function withTextOverrides(base: SiteText, overrides: Record<string, string> | undefined, name: string): SiteText {
  if (!overrides) return base;
  const entries = Object.entries(overrides).filter(([, value]) => value.trim() !== "");
  if (entries.length === 0) return base;
  const root: Record<string, unknown> = { ...base };
  for (const [path, value] of entries) {
    const keys = path.split(".");
    let node = root;
    let ok = true;
    for (const key of keys.slice(0, -1)) {
      const child = node[key];
      if (child === null || typeof child !== "object") {
        ok = false;
        break;
      }
      node[key] = { ...(child as Record<string, unknown>) };
      node = node[key] as Record<string, unknown>;
    }
    const leaf = keys[keys.length - 1];
    if (!ok || !(leaf in node)) continue;
    const text = fill(value, name);
    node[leaf] = typeof node[leaf] === "function" ? () => text : text;
  }
  return root as SiteText;
}

export function defaultText(base: SiteText, path: string): string {
  let node: unknown = base;
  for (const key of path.split(".")) {
    if (node === null || typeof node !== "object") return "";
    node = (node as Record<string, unknown>)[key];
  }
  if (typeof node === "function") return String((node as (value: string) => string)(AGENCY_TOKEN));
  return typeof node === "string" ? node : "";
}

export const TEXT_GROUPS: { title: string; hint: string; keys: { key: string; label: string; long?: boolean }[] }[] = [
  {
    title: "Cabecera y menú",
    hint: "La frase bajo el nombre de la agencia, el botón para cotizar y el nombre de cada enlace del menú.",
    keys: [
      { key: "header.tagline", label: "Frase bajo el nombre" },
      { key: "header.quote", label: "Botón para cotizar" },
      { key: "header.links.destinations", label: "Enlace a destinos" },
      { key: "header.links.tours", label: "Enlace a tours" },
      { key: "header.links.packages", label: "Enlace a paquetes" },
      { key: "header.links.experiences", label: "Enlace a experiencias" },
      { key: "header.links.transfers", label: "Enlace a traslados" },
      { key: "header.links.offers", label: "Enlace a ofertas" },
      { key: "header.links.tailored", label: "Enlace a viajes a medida" },
      { key: "header.links.contact", label: "Enlace a contacto" },
    ],
  },
  {
    title: "Encabezado de la portada",
    hint: `Lo primero que lee el visitante. Escribe ${AGENCY_TOKEN} donde quieras que aparezca el nombre de la agencia.`,
    keys: [
      { key: "home.heroTitle", label: "Título principal" },
      { key: "home.heroBody", label: "Texto bajo el título", long: true },
    ],
  },
  {
    title: "Destinos",
    hint: "Encabezado del bloque de destinos de la portada.",
    keys: [
      { key: "home.destinations.eyebrow", label: "Etiqueta" },
      { key: "home.destinations.title", label: "Título" },
      { key: "home.destinations.description", label: "Descripción", long: true },
      { key: "home.destinations.more", label: "Enlace para ver más" },
    ],
  },
  {
    title: "Tours y paquetes destacados",
    hint: "Encabezado del bloque de productos recomendados.",
    keys: [
      { key: "home.featured.eyebrow", label: "Etiqueta" },
      { key: "home.featured.title", label: "Título" },
      { key: "home.featured.description", label: "Descripción", long: true },
      { key: "home.featured.more", label: "Enlace para ver más" },
    ],
  },
  {
    title: "Ofertas vigentes",
    hint: "Encabezado del bloque de promociones del catálogo.",
    keys: [
      { key: "home.offers.eyebrow", label: "Etiqueta" },
      { key: "home.offers.title", label: "Título" },
      { key: "home.offers.description", label: "Descripción", long: true },
    ],
  },
  {
    title: "Salidas grupales",
    hint: "Encabezado del bloque de próximas salidas con cupos.",
    keys: [
      { key: "home.departures.eyebrow", label: "Etiqueta" },
      { key: "home.departures.title", label: "Título" },
      { key: "home.departures.description", label: "Descripción", long: true },
      { key: "home.departures.more", label: "Enlace para ver más" },
    ],
  },
  {
    title: "Por qué elegirnos",
    hint: "Las tarjetas de confianza. Las de sedes y opiniones se escriben solas con tus datos.",
    keys: [
      { key: "home.priceTitle", label: "Primera tarjeta: título" },
      { key: "home.priceText", label: "Primera tarjeta: texto", long: true },
      { key: "home.formalTitle", label: "Tarjeta de agencia formal" },
      { key: "home.reviewsTitle", label: "Tarjeta de opiniones" },
    ],
  },
  {
    title: "Opiniones",
    hint: "Encabezado del bloque de reseñas.",
    keys: [
      { key: "home.reviews.eyebrow", label: "Etiqueta" },
      { key: "home.reviews.title", label: "Título" },
      { key: "home.reviews.description", label: "Descripción", long: true },
    ],
  },
  {
    title: "Boletín",
    hint: "La invitación a suscribirse al final de la portada.",
    keys: [
      { key: "newsletter.title", label: "Título" },
      { key: "newsletter.body", label: "Texto", long: true },
    ],
  },
  {
    title: "Pie de página",
    hint: "La presentación de la agencia y los títulos de las columnas.",
    keys: [
      { key: "footer.about", label: "Presentación de la agencia", long: true },
      { key: "footer.explore", label: "Título de la columna Explorar" },
      { key: "footer.help", label: "Título de la columna de ayuda" },
      { key: "footer.contactTitle", label: "Título de la columna de contacto" },
    ],
  },
];
