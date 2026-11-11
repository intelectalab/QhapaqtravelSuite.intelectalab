import type { Metadata } from "next";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { UserActivityCard, UserPermissionsCard, UserProfileCard, UserSecurityCard, UserWorkloadCard } from "@/features/users/UserDetailPanels";
import { UserRowActions } from "@/features/users/UserForms";
import { currentUser } from "@/lib/server/me";
import { getUserDetail, listTeam } from "@/lib/server/users";

export const metadata: Metadata = { title: "Usuario" };

export default async function UserDetailPage({ params }: PageProps<"/admin/usuarios/[code]">) {
  const { code } = await params;
  const [user, team, me] = await Promise.all([getUserDetail(code), listTeam(), currentUser()]);
  if (!user || !team) return <NoAccess home="/dashboard" />;
  const row = team.users.find((item) => item.code === user.code);

  return (
    <>
      <PageHeader
        back={{ href: "/admin/usuarios", label: "Usuarios" }}
        leading={<Avatar name={user.name} size="lg" />}
        title={user.name}
        subtitle={[user.role?.name ?? "Sin rol", user.sede?.name, user.email].filter(Boolean).join(" · ")}
        jump={false}
        actions={row ? <UserRowActions user={row} options={team.options} isSelf={row.id === me.id} withView={false} /> : undefined}
      />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div className="flex flex-col gap-5">
          <UserProfileCard user={user} />
          <UserSecurityCard user={user} />
          <UserWorkloadCard user={user} />
        </div>
        <div className="flex flex-col gap-5">
          <UserPermissionsCard user={user} />
          <UserActivityCard user={user} />
        </div>
      </div>
    </>
  );
}
