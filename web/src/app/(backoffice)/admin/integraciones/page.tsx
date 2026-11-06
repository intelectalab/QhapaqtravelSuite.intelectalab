import { AlertOctagon, CalendarClock, Plug } from "lucide-react";
import type { Metadata } from "next";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { AuditTrail } from "@/features/admin/AdminParts";
import { AdaptersGrid, ErrorsTable, JobsTable } from "@/features/admin/Integrations";
import type { Adapter, AdaptersMeta, IntegrationErrorRecord, IntegrationsOverview, ScheduledJob } from "@/lib/admin";
import { getCollection } from "@/lib/server/admin";

export const metadata: Metadata = { title: "Integraciones y jobs" };

export default async function IntegracionesPage() {
  const [adapters, jobs, errors] = await Promise.all([
    getCollection<Adapter, AdaptersMeta>("/integrations", "No pudimos cargar las integraciones.", 100),
    getCollection<ScheduledJob>("/jobs", "No pudimos cargar los procesos programados.", 100),
    getCollection<IntegrationErrorRecord>("/integration-errors", "No pudimos cargar los errores de integración.", 200),
  ]);
  if (!adapters || !jobs || !errors) return <NoAccess home="/dashboard" />;
  const data: IntegrationsOverview = {
    adapters: adapters.data,
    jobs: jobs.data,
    errors: errors.data.map((error) => ({ ...error, resolved_by: error.resolved_by_name })),
    owners: adapters.meta.owners,
    history: adapters.meta.history,
    can_manage: adapters.meta.can_manage,
  };
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
