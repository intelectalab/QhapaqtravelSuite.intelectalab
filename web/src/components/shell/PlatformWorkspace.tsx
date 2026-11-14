import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { BrandStyle } from "@/components/shell/BrandStyle";
import { NotFound } from "@/components/shell/NotFound";
import { WorkspaceProvider, type WorkspaceInfo } from "@/components/shell/Workspace";
import { REALMS } from "@/lib/realms";
import { currentPlatformUser } from "@/lib/server/platform";

export async function PlatformWorkspace({ children }: { children?: ReactNode }) {
  const me = await currentPlatformUser();
  const outside = children === undefined;
  const workspace: WorkspaceInfo = {
    navigation: "platform",
    userId: me.id,
    account: { name: "Consola de plataforma", detail: "KipuControl", initials: "KC" },
    person: { name: me.name, email: me.email, detail: "Super Admin", color: null },
    logoutHref: REALMS.platform.logout,
    counts: {},
    screens: outside ? me.agency_access.screens : null,
    required: outside ? me.agency_access.required : null,
  };

  return (
    <WorkspaceProvider value={workspace}>
      <BrandStyle branding={me.branding} />
      <AppShell>{children ?? <NotFound home={me.home} />}</AppShell>
    </WorkspaceProvider>
  );
}
