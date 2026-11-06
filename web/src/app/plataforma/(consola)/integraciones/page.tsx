import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { AgencyJobsPanel, ErrorsTable, OperationsKpis, PlatformJobs, QueuesPanel } from "@/features/platform/OperationsBoard";
import { getOperations } from "@/lib/server/platformConsole";

export const metadata: Metadata = { title: "Integraciones y tareas" };

export default async function IntegracionesPage() {
  const overview = await getOperations();

  return (
    <>
      <PageHeader
        title="Integraciones y tareas"
        subtitle="Tareas programadas de la plataforma, estado de las colas y fallas de integración de las agencias."
        info={<InfoTip>Las tareas de cobranza y métricas se pueden ejecutar a mano; el resto corre solo en su horario. Pausar una tarea la detiene hasta que la reanudes.</InfoTip>}
      />
      <OperationsKpis overview={overview} />
      <PlatformJobs jobs={overview.jobs} />
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <QueuesPanel queues={overview.queues} />
        <AgencyJobsPanel agencies={overview.agencies} />
      </div>
      <ErrorsTable errors={overview.errors} />
    </>
  );
}
