"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { screenFor } from "@/config/navigation";
import { cn } from "@/lib/cn";
import { rememberScreen } from "@/lib/recentScreens";
import { useStoredValue } from "@/lib/useStoredValue";
import { NoAccess } from "./NoAccess";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useWorkspace } from "./Workspace";

const parseCollapsed = (raw: string | null) => raw === "1";
const serializeCollapsed = (value: boolean) => (value ? "1" : "0");

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { userId, groups, allows } = useWorkspace();
  const [collapsed, setCollapsed] = useStoredValue("qhapaq-menu-collapsed", parseCollapsed, serializeCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const screen = screenFor(pathname, groups);
    if (screen) rememberScreen(userId, screen.href);
  }, [pathname, userId, groups]);

  return (
    <div className="flex h-dvh overflow-hidden">
      <div className="hidden flex-none lg:block">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} onExpand={() => setCollapsed(false)} />
      </div>

      <div className={cn("fixed inset-0 z-50 lg:hidden", mobileOpen ? "pointer-events-auto" : "pointer-events-none")}>
        <div onClick={() => setMobileOpen(false)} className={cn("absolute inset-0 bg-[rgb(14_17_32/0.35)] transition-opacity", mobileOpen ? "opacity-100" : "opacity-0")} />
        <div className={cn("absolute inset-y-0 left-0 transition-transform duration-200", mobileOpen ? "translate-x-0" : "-translate-x-full")}>
          <Sidebar collapsed={false} onToggle={() => setMobileOpen(false)} onNavigate={() => setMobileOpen(false)} />
        </div>
      </div>

      <div className="relative flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="ambient-glow pointer-events-none absolute inset-x-0 top-0 h-[420px]" />
        <Topbar onOpenMenu={() => setMobileOpen(true)} />
        <main className="relative w-full flex-1 px-4 pb-12 sm:px-6 xl:px-8">{allows(pathname) ? children : <NoAccess home={groups[0]?.screens[0]?.href ?? "/"} />}</main>
      </div>
    </div>
  );
}
