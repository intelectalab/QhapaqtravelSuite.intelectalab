import type { Metadata } from "next";
import { AuditTrail } from "@/features/admin/AdminParts";
import { ApiKeysTable } from "@/features/admin/ApiAccess";
import { getApiAccess } from "@/lib/server/adminSections";

export const metadata: Metadata = { title: "API keys" };

export default async function ApiKeysPage() {
  const data = await getApiAccess();
  if (!data) return null;

  return (
    <>
      <ApiKeysTable data={data} />
      <div className="mt-5">
        <AuditTrail entries={data.history} empty="Aún no hay cambios en claves ni webhooks." />
      </div>
    </>
  );
}
