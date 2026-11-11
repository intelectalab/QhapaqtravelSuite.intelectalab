"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export interface SectionTab {
  href: string;
  label: string;
  count?: number;
}

export function SectionTabs({ tabs }: { tabs: SectionTab[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones" className="scroll-thin mb-4 flex w-fit max-w-full gap-1 overflow-x-auto rounded-control bg-surface-2 p-1">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            data-testid={`tab:${tab.href.split("?")[0].split("/").filter(Boolean).pop() ?? "inicio"}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex flex-none items-center gap-1.5 whitespace-nowrap rounded-[10px] px-3.5 py-2 text-[13px] font-semibold transition-[background-color,color,box-shadow] duration-300",
              active ? "bg-surface text-fg shadow-card" : "text-fg-3 hover:text-fg",
            )}
          >
            {tab.label}
            {tab.count !== undefined && <span className={cn("rounded-md px-1.5 font-mono text-[11px]", active ? "bg-accent/10 text-accent" : "bg-surface text-fg-3")}>{tab.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
