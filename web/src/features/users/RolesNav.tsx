"use client";

import { Grid3x3, KeyRound, Map } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { SectionNav } from "@/components/ui/SectionNav";
import { SCOPE_LABEL, type RoleScope, type TeamRole } from "@/lib/roles";

export function RolesNav({ roles }: { roles: TeamRole[] }) {
  const pathname = usePathname();
  const params = useSearchParams();
  const selected = params.get("rol");
  const active = pathname === "/admin/roles" ? (roles.some((role) => role.code === selected) ? selected! : roles[0]?.code ?? "") : pathname;
  const groups = (Object.keys(SCOPE_LABEL) as RoleScope[])
    .map((scope) => ({ title: SCOPE_LABEL[scope], items: roles.filter((role) => role.scope === scope).map((role) => ({ id: role.code, label: role.name, href: `/admin/roles?rol=${role.code}`, count: role.users, icon: <KeyRound size={16} /> })) }))
    .filter((group) => group.items.length > 0);

  return (
    <SectionNav
      label="Roles y vistas"
      active={active}
      testId="roles-nav"
      groups={[
        ...groups,
        {
          title: "Vistas",
          items: [
            { id: "/admin/roles/matriz", label: "Matriz de permisos", href: "/admin/roles/matriz", icon: <Grid3x3 size={16} /> },
            { id: "/admin/roles/mapa", label: "Mapa de acceso", href: "/admin/roles/mapa", icon: <Map size={16} /> },
          ],
        },
      ]}
    />
  );
}
