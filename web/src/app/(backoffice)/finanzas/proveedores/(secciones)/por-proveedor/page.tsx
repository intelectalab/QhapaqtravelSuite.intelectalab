import type { Metadata } from "next";
import { PayablesWorkspace } from "@/features/finance/Payables";
import type { PayablesOverview } from "@/lib/finance";
import { getCachedResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Saldos por proveedor" };

export default async function PayablesProvidersPage() {
  const data = await getCachedResource<PayablesOverview>("/finance/payables", "No pudimos cargar las cuentas por pagar.");
  if (!data) return null;
  return <PayablesWorkspace data={data} section="providers" />;
}
