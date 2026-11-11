"use client";

import { GalleryHorizontalEnd, LayoutPanelTop, ListOrdered, Menu, Paintbrush, Palette, Rocket, Search, Type } from "lucide-react";
import { SectionNav } from "@/components/ui/SectionNav";
import { SITE_SECTIONS, type PersonalizationSection, type SiteSectionKey } from "./sections";

const ICONS: Record<SiteSectionKey, typeof Palette> = {
  "sitio-estilo": Paintbrush,
  "sitio-portada": LayoutPanelTop,
  "sitio-secciones": ListOrdered,
  "sitio-banners": GalleryHorizontalEnd,
  "sitio-menu": Menu,
  "sitio-textos": Type,
  "sitio-buscadores": Search,
  "sitio-publicar": Rocket,
};

const href = (id: PersonalizationSection) => `/admin/personalizacion?seccion=${id}`;

export function PersonalizationNav({ active, pending }: { active: PersonalizationSection; pending?: number }) {
  return (
    <SectionNav
      label="Secciones de personalización"
      active={active}
      testId="personalization-nav"
      groups={[
        { title: "Panel interno", items: [{ id: "panel", label: "Colores y tarjetas", href: href("panel"), icon: <Palette size={16} /> }] },
        {
          title: "Sitio web",
          items: SITE_SECTIONS.map((section) => {
            const Icon = ICONS[section.id];
            return { id: section.id, label: section.label, href: href(section.id), icon: <Icon size={16} />, ...(section.id === "sitio-publicar" && pending ? { count: pending } : {}) };
          }),
        },
      ]}
    />
  );
}
