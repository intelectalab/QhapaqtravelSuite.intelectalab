import type { Metadata } from "next";
import { PortalPayments } from "@/features/portal/PortalPayments";
import type { PortalBilling } from "@/lib/portal";
import { portalData, portalPaymentGateway } from "@/lib/server/portal";

export const metadata: Metadata = { title: "Pagos" };

export default async function PortalPaymentsPage() {
  const [billing, gateway] = await Promise.all([portalData<PortalBilling>("/receivables", "No pudimos cargar tus pagos."), portalPaymentGateway()]);
  return <PortalPayments billing={billing} gateway={gateway} />;
}
