"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useStoredValue } from "@/lib/useStoredValue";

export interface SidebarSlot {
  collapsed: boolean;
  onToggle: () => void;
  onExpand?: () => void;
  onNavigate?: () => void;
  tagged?: boolean;
}

const parseCollapsed = (raw: string | null) => raw === "1";
const serializeCollapsed = (value: boolean) => (value ? "1" : "0");

export function ShellFrame({ sidebar, topbar, children }: { sidebar: (slot: SidebarSlot) => ReactNode; topbar: (openMenu: () => void) => ReactNode; children: ReactNode }) {
  const [collapsed, setCollapsed] = useStoredValue("kipucontrol-menu-collapsed", parseCollapsed, serializeCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-dvh overflow-hidden" data-testid="app-shell">
      <div className="hidden flex-none lg:block">{sidebar({ collapsed, onToggle: () => setCollapsed(!collapsed), onExpand: () => setCollapsed(false) })}</div>

      <div className={cn("fixed inset-0 z-50 lg:hidden", mobileOpen ? "pointer-events-auto" : "pointer-events-none")}>
        <div onClick={() => setMobileOpen(false)} className={cn("absolute inset-0 bg-[rgb(14_17_32/0.35)] transition-opacity", mobileOpen ? "opacity-100" : "opacity-0")} />
        <div className={cn("absolute inset-y-0 left-0 transition-transform duration-200", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
          {sidebar({ collapsed: false, onToggle: () => setMobileOpen(false), onNavigate: () => setMobileOpen(false), tagged: false })}
        </div>
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="ambient-glow pointer-events-none absolute inset-x-0 top-0 h-[420px]" />
        <div className="sticky top-0 z-30">{topbar(() => setMobileOpen(true))}</div>
        {children}
      </div>
    </div>
  );
}
