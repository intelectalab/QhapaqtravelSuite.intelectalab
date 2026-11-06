import { AlertOctagon, CalendarClock, Plug } from "lucide-react";
import type { Metadata } from "next";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { AuditTrail } from "@/features/admin/AdminParts";
import { AdaptersGrid, ErrorsTable, JobsTable } from "@/features/admin/Integrations";
import type { IntegrationsOverview } from "@/lib/admin";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Integraciones y jobs" };

export default async function IntegracionesPage() {
  const data = await getResource<IntegrationsOverview>("/admin/integrations", "No pudimos cargar las integraciones.");
  if (!data) return <NoAccess home="/dashboard" />;
  const active = data.adapters.filter((adapter) => adapter.status === "activo").length;
  const open = data.errors.filter((error) => error.status !== "resuelto").length;
  const paused = data.jobs.filter((job) => job.paused).length;

  return (
    <>
      <PageHeader
        title="Integraciones y jobs"
        subtitle={`${active} de ${data.adapters.length} integraciones en producción · ${data.jobs.length} procesos programados${paused > 0 ? ` (${paused} en pausa)` : ""} · ${open} ${open === 1 ? "error abierto" : "errores abiertos"}.`}
        info={<InfoTip>No inventamos APIs ni credenciales: las integraciones sin proveedor quedan por validar y no pasan a producción. Los errores temporales (tiempo de espera, 5xx, 429) se reintentan con espera creciente; los permanentes se resuelven a mano.</InfoTip>}
      />
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
        <Plug size={17} className="text-accent" />
        Integraciones
      </h2>
      <AdaptersGrid data={data} />
      <h2 className="mb-3 mt-6 flex items-center gap-2 text-[15px] font-semibold">
        <CalendarClock size={17} className="text-accent" />
        Procesos programados
      </h2>
      <JobsTable data={data} />
      <h2 className="mb-3 mt-6 flex items-center gap-2 text-[15px] font-semibold">
        <AlertOctagon size={17} className="text-accent" />
        Errores y reintentos
      </h2>
      <ErrorsTable data={data} />
      <div className="mt-5">
        <AuditTrail entries={data.history} empty="Aún no hay cambios en integraciones ni procesos." />
      </div>
    </>
  );
}
