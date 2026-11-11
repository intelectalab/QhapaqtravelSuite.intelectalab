import type { Metadata } from "next";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { RoleCreateAction, RolesWorkspace } from "@/features/users/RolesWorkspace";
import { RolesTabs } from "@/features/users/RolesTabs";
import { getRoleDetail, listRoles } from "@/lib/server/users";

export const metadata: Metadata = { title: "Roles y permisos" };

export default async function RolesPage({ searchParams }: PageProps<"/admin/roles">) {
  const { rol } = await searchParams;
  const data = await listRoles();
  if (!data) return <NoAccess home="/dashboard" />;
  const selected = typeof rol === "string" && data.roles.some((role) => role.code === rol) ? rol : data.roles[0]?.code;
  const detail = selected ? await getRoleDetail(selected) : null;

  return (
    <>
      <PageHeader
        title="Roles y permisos"
        subtitle={`${data.roles.length} roles · los cambios se aplican en la siguiente acción de cada usuario`}
        info={<InfoTip>Los roles base no se renombran ni se eliminan, pero puedes ajustar sus permisos. Algunos permisos están protegidos: el administrador siempre conserva la gestión de usuarios y roles, y los roles móviles o externos no ven finanzas.</InfoTip>}
        actions={<RoleCreateAction roles={data.roles} />}
      />
      <RolesTabs />
      <RolesWorkspace roles={data.roles} catalog={data.catalog} initial={selected} detail={detail} />
    </>
  );
}
