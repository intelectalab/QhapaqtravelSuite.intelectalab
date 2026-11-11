import type { Metadata } from "next";
import { ErrorsTable } from "@/features/admin/Integrations";
import { getIntegrations } from "@/lib/server/adminSections";

export const metadata: Metadata = { title: "Errores y reintentos" };

export default async function IntegracionesErroresPage() {
  const data = await getIntegrations();
  if (!data) return null;
  return <ErrorsTable data={data} />;
}
