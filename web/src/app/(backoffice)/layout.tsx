import { AppShell } from "@/components/shell/AppShell";
import { SessionProvider } from "@/components/shell/SessionProvider";
import { WorkspaceProvider, type WorkspaceInfo } from "@/components/shell/Workspace";
import { roleLabel } from "@/lib/me";
import { getAccess, getNavCounts } from "@/lib/server/dashboard";
import { currentUser } from "@/lib/server/me";

export default async function BackofficeLayout({ children }: LayoutProps<"/">) {
  const me = await currentUser();
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
      <WorkspaceProvider value={workspace}>
        <AppShell>{children}</AppShell>
      </WorkspaceProvider>
    </SessionProvider>
  );
}
