import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { BrandStyle } from "@/components/shell/BrandStyle";
import { NotFound, NotFoundPage } from "@/components/shell/NotFound";
import { SessionProvider } from "@/components/shell/SessionProvider";
import { WorkspaceProvider, type WorkspaceInfo } from "@/components/shell/Workspace";
import { TileVariantProvider } from "@/components/ui/TileVariant";
import { roleLabel } from "@/lib/me";
import { getAccess, getNavCounts } from "@/lib/server/dashboard";
import { currentUser } from "@/lib/server/me";

const EXTERNAL_HOMES = ["/portal", "/agencia", "/proveedor"];

export async function AgencyWorkspace({ children }: { children?: ReactNode }) {
  const me = await currentUser();
  if (EXTERNAL_HOMES.includes(me.home)) return <NotFoundPage home={me.home} />;
  const [counts, access] = await Promise.all([getNavCounts(), getAccess()]);
  const workspace: WorkspaceInfo = {
    navigation: "agency",
    userId: me.id,
    account: { name: me.tenant.name, detail: me.sede.name, initials: me.tenant.initials },
    person: { name: me.name, email: me.email, detail: roleLabel(me.role), color: me.avatar_color },
    logoutHref: "/salir",
    counts,
    screens: access?.screens ?? null,
    required: access?.required ?? null,
    locked: access?.locked ?? null,
  };

  return (
    <SessionProvider me={me}>
      <BrandStyle branding={me.tenant.branding} />
      <TileVariantProvider variant={me.tenant.branding?.tile_variant}>
        <WorkspaceProvider value={workspace}>
          <AppShell>{children ?? <NotFound home={me.home} />}</AppShell>
        </WorkspaceProvider>
      </TileVariantProvider>
    </SessionProvider>
  );
}
