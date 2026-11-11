"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SectionNav } from "./SectionNav";

export interface PathSectionItem {
  href: string;
  label: string;
  icon?: ReactNode;
  count?: number;
}

export interface PathSectionGroup {
  title: string;
  items: PathSectionItem[];
}

export function PathSectionNav({ label, groups, testId }: { label: string; groups: PathSectionGroup[]; testId?: string }) {
  const pathname = usePathname();
  const items = groups.flatMap((group) => group.items);
  const active = items.filter((item) => pathname === item.href || pathname.startsWith(`${item.href}/`)).sort((a, b) => b.href.length - a.href.length)[0]?.href ?? items[0]?.href ?? "";

  return <SectionNav label={label} active={active} testId={testId} groups={groups.map((group) => ({ title: group.title, items: group.items.map((item) => ({ id: item.href, label: item.label, href: item.href, icon: item.icon, count: item.count })) }))} />;
}
