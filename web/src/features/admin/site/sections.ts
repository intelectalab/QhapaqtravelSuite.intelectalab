export type SiteSectionKey = "sitio-estilo" | "sitio-portada" | "sitio-secciones" | "sitio-banners" | "sitio-menu" | "sitio-textos" | "sitio-buscadores" | "sitio-publicar";

export type PersonalizationSection = "panel" | SiteSectionKey;

export const SITE_SECTIONS: { id: SiteSectionKey; label: string }[] = [
  { id: "sitio-estilo", label: "Marca y estilo" },
  { id: "sitio-portada", label: "Portada" },
  { id: "sitio-secciones", label: "Orden de secciones" },
  { id: "sitio-banners", label: "Avisos y banners" },
  { id: "sitio-menu", label: "Menú y pie de página" },
  { id: "sitio-textos", label: "Textos" },
  { id: "sitio-buscadores", label: "Google y redes" },
  { id: "sitio-publicar", label: "Publicar" },
];

export const PERSONALIZATION_SECTIONS: PersonalizationSection[] = ["panel", ...SITE_SECTIONS.map((section) => section.id)];
