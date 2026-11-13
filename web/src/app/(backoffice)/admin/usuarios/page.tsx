import type { Metadata } from "next";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { UserInviteAction } from "@/features/users/UserForms";
import { UsersTable } from "@/features/users/UsersTable";
import { currentUser } from "@/lib/server/me";
import { listSedes, listTeam } from "@/lib/server/users";

export const metadata: Metadata = { title: "Usuarios" };

export default async function UsuariosPage({ searchParams }: PageProps<"/admin/usuarios">) {
  const { q } = await searchParams;
  const [team, me, sedes] = await Promise.all([listTeam(), currentUser(), listSedes()]);
  if (!team) return <NoAccess home="/dashboard" />;
  const internal = team.users.filter((user) => user.status === "activo" && !user.channel).length;
  const channel = team.users.filter((user) => user.status === "activo" && user.channel).length;
  const activeSedes = sedes?.sedes.filter((sede) => sede.status === "activa").length ?? null;
  const sedeText = activeSedes === null || !sedes ? null : sedes.limit === null ? `${activeSedes} sedes activas` : `${activeSedes} de ${sedes.limit} sedes del plan`;

  return (
    <>
      <PageHeader
        title="Usuarios"
        subtitle={[`${internal} activos internos`, channel > 0 ? `${channel} de canal` : null, sedeText].filter(Boolean).join(" · ")}
        info={<InfoTip>Las personas invitadas reciben un correo para crear su contraseña. El enlace vence a las 72 horas. Los roles con datos sensibles exigen verificación en dos pasos. Los usuarios internos son el equipo de la agencia y cuentan para el límite del plan; los de canal son clientes, agencias aliadas, proveedores y pasajeros con acceso a su portal.</InfoTip>}
        actions={<UserInviteAction options={team.options} />}
      />
      <UsersTable users={team.users} options={team.options} viewerId={me.id} initialSearch={typeof q === "string" ? q : undefined} />
    </>
  );
}
