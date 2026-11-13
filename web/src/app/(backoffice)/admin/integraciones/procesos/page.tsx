import type { Metadata } from "next";
import { JobsTable, SchedulerCard } from "@/features/admin/Integrations";
import { getIntegrations } from "@/lib/server/adminSections";

export const metadata: Metadata = { title: "Jobs y scheduler" };

export default async function IntegracionesProcesosPage() {
  const data = await getIntegrations();
  if (!data) return null;
  return (
    <>
      {data.scheduler && <SchedulerCard scheduler={data.scheduler} />}
      <JobsTable data={data} />
    </>
  );
}
