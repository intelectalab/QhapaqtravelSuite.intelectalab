import type { Metadata } from "next";
import { NoAccess } from "@/components/shell/NoAccess";
import { ExportsView } from "@/features/reports/ExportsView";
import { getReportExports } from "@/lib/server/reports";

export const metadata: Metadata = { title: "Exportaciones" };

export default async function ExportacionesPage() {
  const data = await getReportExports();
  if (!data || !data.can_export) return <NoAccess home="/reportes" />;
  return <ExportsView data={data} />;
}
