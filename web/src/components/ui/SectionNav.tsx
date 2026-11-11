"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Select } from "./Select";

export interface SectionNavItem {
  id: string;
  label: string;
  href: string;
  count?: number;
  icon?: ReactNode;
}

export interface SectionNavGroup {
  title: string;
  items: SectionNavItem[];
}

interface SectionNavProps {
  label: string;
  groups: SectionNavGroup[];
  active: string;
  testId?: string;
}

export function SectionLayout({ nav, children }: { nav: ReactNode; children: ReactNode }) {
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-6">
      {nav}
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function SectionNav({ label, groups, active, testId = "section-nav" }: SectionNavProps) {
  const router = useRouter();
  const items = groups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.title })));

  return (
    <>
      <div className="lg:hidden">
        <Select
          value={active}
          onChange={(id) => {
            const target = items.find((item) => item.id === id);
            if (target) router.replace(target.href, { scroll: false });
          }}
          options={items.map((item) => ({ value: item.id, label: item.count === undefined ? item.label : `${item.label} (${item.count})`, hint: item.group }))}
          ariaLabel={label}
          className="h-11 w-full"
          testId={`${testId}-select`}
        />
      </div>
      <nav aria-label={label} data-testid={testId} className="sticky top-20 hidden max-h-[calc(100vh-6rem)] overflow-y-auto rounded-card border border-line bg-surface p-2 shadow-card lg:block">
        {groups.map((group, index) => (
          <div key={group.title} className={cn(index > 0 && "mt-2 border-t border-line-2 pt-2")}>
            <p className="px-2.5 pb-1.5 pt-1 text-[12px] font-semibold text-fg-3">{group.title}</p>
            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const current = item.id === active;
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      scroll={false}
                      replace
                      aria-current={current ? "page" : undefined}
                      data-testid={`${testId}:${item.id}`}
                      className={cn("group flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] font-semibold transition", current ? "bg-accent text-white shadow-[0_6px_14px_-8px_var(--accent)]" : "text-fg-2 hover:translate-x-0.5 hover:bg-surface-2 hover:text-fg")}
                    >
                      {item.icon && <span className={cn("flex-none transition", current ? "text-white" : "text-fg-3 group-hover:text-accent")}>{item.icon}</span>}
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {item.count !== undefined && <span className={cn("flex-none rounded-full px-1.5 text-[11px] tabular-nums", current ? "bg-white/20" : "bg-surface-2 text-fg-3 group-hover:bg-surface")}>{item.count}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}
