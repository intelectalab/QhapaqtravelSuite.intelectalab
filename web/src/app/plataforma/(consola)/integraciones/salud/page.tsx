import type { Metadata } from "next";
import { HealthTable } from "@/features/platform/OperationsBoard";
import { getTenantHealth } from "@/lib/server/platformConsole";

export const metadata: Metadata = { title: "Salud por agencia" };

export default async function SaludPage() {
  const health = await getTenantHealth();

  return <HealthTable rows={health.rows} />;
}
