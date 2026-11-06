import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/AppShell";
import { BrandStyle } from "@/components/shell/BrandStyle";
import { SessionProvider } from "@/components/shell/SessionProvider";
import { WorkspaceProvider, type WorkspaceInfo } from "@/components/shell/Workspace";
import { TileVariantProvider } from "@/components/ui/TileVariant";
import { roleLabel } from "@/lib/me";
import { getAccess, getNavCounts } from "@/lib/server/dashboard";
import { currentUser } from "@/lib/server/me";

export default async function BackofficeLayout({ children }: LayoutProps<"/">) {
  const me = await currentUser();
  if (me.home === "/portal" || me.home === "/agencia") redirect(me.home);
  if (me.home === "/proveedor") redirect(me.home);
  const [counts, access] = await Promise.all([getNavCounts(), getAccess()]);
  const workspace: WorkspaceInfo = {
    navigation: "agency",
    userId: me.id,
    account: { name: me.tenant.name, detail: me.sede.name, initials: me.tenant.initials },
    person: { name: me.name, email: me.email, detail: roleLabel(me.role), color: me.avatar_color },
    logoutHref: "/salir",
    counts,
    screens: access?.screens ?? null,
  };

  return (
    <SessionProvider me={me}>
      <BrandStyle branding={me.tenant.branding} />
      <TileVariantProvider variant={me.tenant.branding?.tile_variant}>
        <WorkspaceProvider value={workspace}>
          <AppShell>{children}</AppShell>
        </WorkspaceProvider>
      </TileVariantProvider>
    </SessionProvider>
  );
}
