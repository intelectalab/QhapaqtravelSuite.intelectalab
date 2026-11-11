import type { Metadata } from "next";
import { NoAccess } from "@/components/shell/NoAccess";
import { InvoicesTable } from "@/features/admin/Subscription";
import { getSubscription } from "@/lib/server/subscription";

export const metadata: Metadata = { title: "Facturas de la plataforma" };

export default async function FacturasPage() {
  const data = await getSubscription();
  if (!data) return <NoAccess home="/dashboard" />;
  return <InvoicesTable invoices={data.invoices} manage={data.can_manage} />;
}
