import type { ReactNode } from "react";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { getIntegrations } from "@/lib/server/adminSections";

const BASE = "/admin/integraciones";

export default async function IntegracionesLayout({ children }: { children: ReactNode }) {
  const data = await getIntegrations();
  if (!data) return <NoAccess home="/dashboard" />;

  return (
    <>
      <PageHeader
        title="Integraciones y tareas"
        subtitle="Conexiones con proveedores externos, procesos que corren solos y los errores que dejan."
        info={<InfoTip>No inventamos APIs ni credenciales: las integraciones sin proveedor quedan por validar y no pasan a producción. Los errores temporales (tiempo de espera, 5xx, 429) se reintentan con espera creciente; los permanentes se resuelven a mano.</InfoTip>}
      />
      <TabbedCard
        tabs={[
          { href: BASE, label: "Integraciones", count: data.adapters.length },
          { href: `${BASE}/procesos`, label: "Jobs y scheduler", count: data.jobs.length },
          { href: `${BASE}/errores`, label: "Errores y reintentos", count: data.errors.length },
        ]}
      >
        {children}
      </TabbedCard>
    </>
  );
}
