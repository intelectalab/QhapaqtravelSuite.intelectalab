import type { ReactNode } from "react";
import type { SectionNavGroup } from "@/components/ui/SectionNav";

export interface SectionDef {
  group: string;
  id: string;
  label: string;
  icon?: ReactNode;
  count?: number;
  show?: boolean;
}

export function sectionHref(base: string, id: string, first: string, param = "seccion") {
  return id === first ? base : `${base}?${param}=${encodeURIComponent(id)}`;
}

export function resolveSections(base: string, defs: SectionDef[], requested: string | string[] | undefined) {
  const visible = defs.filter((section) => section.show !== false);
  const first = visible[0]?.id ?? "";
  const wanted = Array.isArray(requested) ? requested[0] : requested;
  const active = visible.some((section) => section.id === wanted) ? (wanted as string) : first;
  const groups: SectionNavGroup[] = [...new Set(visible.map((section) => section.group))].map((title) => ({
    title,
    items: visible.filter((section) => section.group === title).map((section) => ({ id: section.id, label: section.label, icon: section.icon, count: section.count, href: sectionHref(base, section.id, first) })),
  }));
  return { active, groups };
}
