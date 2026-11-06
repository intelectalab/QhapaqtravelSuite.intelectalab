import type { Metadata } from "next";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { SectionTabs } from "@/components/ui/SectionTabs";
import { UserInviteAction } from "@/features/users/UserForms";
import { UsersTable } from "@/features/users/UsersTable";
import { currentUser } from "@/lib/server/me";
import { listTeam } from "@/lib/server/users";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsuariosPage() {
  const [team, me] = await Promise.all([listTeam(), currentUser()]);
  if (!team) return <NoAccess home="/dashboard" />;
  const active = team.users.filter((user) => user.status === "activo").length;

  return (
    <>
      <PageHeader
        title="Usuarios y sedes"
        subtitle={`${active} activos en tu agencia`}
        info={<InfoTip>Las personas invitadas reciben un correo para crear su contraseña. El enlace vence a las 72 horas. Los roles con datos sensibles exigen verificación en dos pasos.</InfoTip>}
        actions={<UserInviteAction options={team.options} />}
      />
      <SectionTabs
        tabs={[
          { href: "/admin/usuarios", label: "Usuarios", count: team.users.length },
          { href: "/admin/usuarios/sedes", label: "Sedes", count: team.options.sedes.length },
        ]}
      />
      <UsersTable users={team.users} options={team.options} viewerId={me.id} />
    </>
  );
}
