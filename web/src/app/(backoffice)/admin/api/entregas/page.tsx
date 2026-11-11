import type { Metadata } from "next";
import { DeliveriesTable } from "@/features/admin/ApiAccess";
import { getApiAccess } from "@/lib/server/adminSections";

export const metadata: Metadata = { title: "Log de entregas" };

export default async function ApiEntregasPage() {
  const data = await getApiAccess();
  if (!data) return null;
  return <DeliveriesTable data={data} />;
}
