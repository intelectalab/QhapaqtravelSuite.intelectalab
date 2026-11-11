"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface RouteTab {
  href: string;
  label: string;
  count?: number;
}

export function RouteTabs({ tabs, active: forced }: { tabs: RouteTab[]; active?: string }) {
  const pathname = usePathname();
  const active = forced ?? tabs.filter((tab) => pathname === tab.href || pathname.startsWith(`${tab.href}/`)).sort((a, b) => b.href.length - a.href.length)[0]?.href ?? tabs[0]?.href;

  return (
    <nav aria-label="Secciones" className="scroll-thin flex gap-1 overflow-x-auto border-b border-line px-5">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          scroll={false}
          aria-current={tab.href === active ? "page" : undefined}
          data-testid={`tab:${tab.href.split(/[/?=]/).filter(Boolean).pop()}`}
          className={cn("-mb-px flex flex-none items-center gap-1.5 border-b-2 px-2.5 py-3.5 text-[13.5px] font-medium transition", tab.href === active ? "border-brand font-semibold text-fg" : "border-transparent text-fg-3 hover:text-fg")}
        >
          {tab.label}
          {tab.count !== undefined && <span className="rounded-md bg-surface-2 px-1.5 font-mono text-[11px] font-semibold text-fg-2">{tab.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

export function TabbedCard({ tabs, active, padded = true, children }: { tabs: RouteTab[]; active?: string; padded?: boolean; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <RouteTabs tabs={tabs} active={active} />
      <div className={cn("[&_.shadow-card]:shadow-none", padded && "p-5")}>{children}</div>
    </section>
  );
}
