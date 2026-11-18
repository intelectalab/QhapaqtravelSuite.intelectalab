import type { Metadata } from "next";
import { OperationsKpis, PlatformJobs, QueuesPanel } from "@/features/platform/OperationsBoard";
import { getOperations } from "@/lib/server/platformConsole";

export const metadata: Metadata = { title: "Integraciones y tareas" };

export default async function IntegracionesPage() {
  const overview = await getOperations();

  return (
    <>
      <OperationsKpis overview={overview} />
      <PlatformJobs jobs={overview.jobs} />
      <QueuesPanel queues={overview.queues} />
    </>
  );
}
