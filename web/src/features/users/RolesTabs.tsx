import { SectionTabs } from "@/components/ui/SectionTabs";

export function RolesTabs() {
  return (
    <SectionTabs
      tabs={[
        { href: "/admin/roles", label: "Roles y permisos" },
        { href: "/admin/roles/matriz", label: "Matriz de permisos" },
        { href: "/admin/roles/mapa", label: "Mapa de acceso" },
      ]}
    />
  );
}
