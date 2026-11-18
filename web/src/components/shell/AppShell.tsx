"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { screenFor } from "@/config/navigation";
import { rememberScreen } from "@/lib/recentScreens";
import { FeatureLocked } from "./FeatureLocked";
import { NoAccess } from "./NoAccess";
import { ReadOnlyBar } from "./ReadOnlyBar";
import { ShellFrame } from "./ShellFrame";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { useWorkspace } from "./Workspace";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { userId, groups, allows, lockedFor, requiredFor, navigation } = useWorkspace();
  const home = groups[0]?.screens[0]?.href ?? "/";
  const locked = lockedFor(pathname);

  useEffect(() => {
    const screen = screenFor(pathname, groups);
    if (screen) rememberScreen(userId, screen.href);
  }, [pathname, userId, groups]);

  return (
    <ShellFrame
      sidebar={(slot) => <Sidebar {...slot} />}
      topbar={(openMenu) => (
        <>
          {navigation === "agency" && <ReadOnlyBar />}
          <Topbar onOpenMenu={openMenu} />
        </>
      )}
    >
      <main className="relative w-full flex-1 px-4 pb-12 sm:px-6 xl:px-8">
        {!allows(pathname) ? <NoAccess home={home} path={pathname} permissions={requiredFor(pathname)} requestable={navigation === "agency"} /> : locked ? <FeatureLocked feature={locked} home={home} canManagePlan={allows("/admin/suscripcion")} /> : children}
      </main>
    </ShellFrame>
  );
}
