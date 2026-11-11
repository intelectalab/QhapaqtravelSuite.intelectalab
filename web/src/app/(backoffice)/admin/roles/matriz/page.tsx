import type { Metadata } from "next";
import { RolesLayout } from "@/features/users/TeamSections";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { PermissionMatrix } from "@/features/users/PermissionMatrix";
import { getPermissionMatrix } from "@/lib/server/users";
import { currentUser } from "@/lib/server/me";

export const metadata: Metadata = { title: "Matriz de permisos" };

export default async function PermissionMatrixPage() {
  const [data, me] = await Promise.all([getPermissionMatrix(), currentUser()]);
  if (!data) return <NoAccess home="/dashboard" />;

  return (
    <>
      <PageHeader
        title="Roles y permisos"
        subtitle={`${data.roles.length} roles × ${data.modules.reduce((total, item) => total + item.permissions.length, 0)} permisos`}
        info={<InfoTip>Los cambios se aplican en la siguiente acción de cada usuario y quedan en la auditoría. El administrador siempre conserva la gestión de usuarios y roles, y los roles móviles o externos no ven finanzas.</InfoTip>}
      />
      <RolesLayout>
        <PermissionMatrix data={data} canEdit={me.permissions.includes("admin.roles.manage")} />
      </RolesLayout>
    </>
  );
}
