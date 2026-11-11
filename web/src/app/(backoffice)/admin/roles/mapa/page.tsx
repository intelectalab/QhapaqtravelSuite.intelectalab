import type { Metadata } from "next";
import { RolesLayout } from "@/features/users/TeamSections";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { AccessMap } from "@/features/users/AccessMap";
import { getAccessMap } from "@/lib/server/users";

export const metadata: Metadata = { title: "Mapa de acceso" };

export default async function AccessMapPage() {
  const data = await getAccessMap();
  if (!data) return <NoAccess home="/dashboard" />;

  return (
    <>
      <PageHeader
        title="Roles y permisos"
        subtitle={`Qué pantallas del back-office ve cada uno de los ${data.roles.length} roles`}
        info={<InfoTip>Una pantalla aparece para un rol si tiene al menos uno de los permisos que esa pantalla exige. Para cambiarlo, ajusta los permisos del rol.</InfoTip>}
      />
      <RolesLayout>
        <AccessMap data={data} />
      </RolesLayout>
    </>
  );
}
