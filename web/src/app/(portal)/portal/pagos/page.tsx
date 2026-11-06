import type { Metadata } from "next";
import { PortalPayments } from "@/features/portal/PortalPayments";
import type { PortalBilling } from "@/lib/portal";
import { portalData } from "@/lib/server/portal";

export const metadata: Metadata = { title: "Pagos" };

export default async function PortalPaymentsPage() {
  const billing = await portalData<PortalBilling>("/billing", "No pudimos cargar tus pagos.");
  return <PortalPayments billing={billing} />;
}
