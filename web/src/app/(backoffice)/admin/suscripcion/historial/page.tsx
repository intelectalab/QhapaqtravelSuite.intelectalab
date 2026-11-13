import type { Metadata } from "next";
import { NoAccess } from "@/components/shell/NoAccess";
import { HistoryTab } from "@/features/admin/SubscriptionPanels";
import { getSubscription } from "@/lib/server/subscription";

export const metadata: Metadata = { title: "Historial de consumo" };

export default async function HistorialPage() {
  const data = await getSubscription();
  if (!data) return <NoAccess home="/dashboard" />;
  return <HistoryTab history={data.history} usage={data.usage} />;
}
