import type { Metadata } from "next";
import { AgencyVisitsTable } from "@/features/tracking/PlatformMarketing";
import { platformGet } from "@/lib/server/platform";
import type { AgencyVisits } from "@/lib/tracking";

export const metadata: Metadata = { title: "Visitas por agencia" };

export default async function AgenciasVitrinaPage() {
  const rows = await platformGet<AgencyVisits[]>("/analytics/web/agencies?days=30");
  return <AgencyVisitsTable rows={rows} />;
}
