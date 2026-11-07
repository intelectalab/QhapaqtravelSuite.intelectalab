import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { BrandStyle } from "@/components/shell/BrandStyle";
import { WorkspaceProvider, type WorkspaceInfo } from "@/components/shell/Workspace";
import { REALMS } from "@/lib/realms";
import { currentPlatformUser } from "@/lib/server/platform";

export default async function PlatformConsoleLayout({ children }: { children: ReactNode }) {
  const me = await currentPlatformUser();
  const workspace: WorkspaceInfo = {
    navigation: "platform",
    userId: me.id,
    account: { name: "Consola de plataforma", detail: "Qhapaq Travel Suite", initials: "QT" },
    person: { name: me.name, email: me.email, detail: "Super Admin", color: null },
    logoutHref: REALMS.platform.logout,
    counts: {},
    screens: null,
  };

  return (
    <WorkspaceProvider value={workspace}>
      <BrandStyle branding={me.branding} />
      <AppShell>{children}</AppShell>
    </WorkspaceProvider>
  );
}
