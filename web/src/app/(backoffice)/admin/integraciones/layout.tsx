import { PlugZap, Radio, Timer } from "lucide-react";
import type { ReactNode } from "react";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { TintTile } from "@/components/ui/Tinted";
import { KpiGrid } from "@/features/admin/AdminParts";
import { formatDateTime } from "@/lib/format";
import { getIntegrations } from "@/lib/server/adminSections";

const BASE = "/admin/integraciones";

export default async function IntegracionesLayout({ children }: { children: ReactNode }) {
  const data = await getIntegrations();
  if (!data) return <NoAccess home="/dashboard" />;
  const live = data.adapters.filter((adapter) => adapter.status === "activo").length;
  const next = data.jobs.filter((job) => !job.paused && job.next_run_at).sort((a, b) => (a.next_run_at ?? "").localeCompare(b.next_run_at ?? ""))[0];
  const tested = data.adapters.filter((adapter) => adapter.last_test).sort((a, b) => (b.last_test?.at ?? "").localeCompare(a.last_test?.at ?? ""))[0];

  return (
    <>
      <PageHeader
        title="Integraciones y jobs"
        subtitle="Conexiones con proveedores externos, procesos que corren solos y los errores que dejan."
        info={<InfoTip>No inventamos APIs ni credenciales: las integraciones sin proveedor quedan por validar y no pasan a producción. Los errores temporales (tiempo de espera, 5xx, 429) se reintentan con espera creciente; los permanentes se resuelven a mano.</InfoTip>}
      />
      <KpiGrid columns={3}>
        <TintTile icon={Radio} tone="ok" label="En producción" value={`${live} de ${data.adapters.length}`} note="Integraciones activas" info={<p>Integraciones con estado activo frente al total de adaptadores de la agencia. Las demás siguen en pruebas o por validar.</p>} />
        <TintTile icon={Timer} tone="t1" label="Próximo proceso" value={next?.next_run_at ? formatDateTime(next.next_run_at, false) : "Sin programar"} note={next?.name} info={<p>La ejecución programada más cercana entre los procesos que no están en pausa.</p>} />
        <TintTile icon={PlugZap} tone={tested?.last_test?.ok === false ? "bad" : "t4"} label="Última prueba de conexión" value={tested?.last_test ? (tested.last_test.ok ? "Correcta" : "Fallida") : "Sin pruebas"} note={tested?.last_test ? `${tested.name} · ${formatDateTime(tested.last_test.at, false)}` : undefined} info={<p>Resultado de la prueba de conexión más reciente entre todas las integraciones.</p>} />
      </KpiGrid>
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
