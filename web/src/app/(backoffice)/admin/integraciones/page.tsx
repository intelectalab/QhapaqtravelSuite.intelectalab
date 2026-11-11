import type { Metadata } from "next";
import { AuditTrail } from "@/features/admin/AdminParts";
import { AdaptersGrid } from "@/features/admin/Integrations";
import { getIntegrations } from "@/lib/server/adminSections";

export const metadata: Metadata = { title: "Integraciones" };

export default async function IntegracionesPage() {
  const data = await getIntegrations();
  if (!data) return null;

  return (
    <>
      <AdaptersGrid data={data} />
      <div className="mt-5">
        <AuditTrail entries={data.history} empty="Aún no hay cambios en integraciones ni procesos." />
      </div>
    </>
  );
}
