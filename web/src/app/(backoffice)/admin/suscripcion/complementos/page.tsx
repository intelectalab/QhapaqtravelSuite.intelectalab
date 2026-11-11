import type { Metadata } from "next";
import { NoAccess } from "@/components/shell/NoAccess";
import { Card } from "@/components/ui/Card";
import { AddonsTable } from "@/features/admin/SubscriptionActions";
import { getSubscription } from "@/lib/server/subscription";

export const metadata: Metadata = { title: "Complementos" };

export default async function ComplementosPage() {
  const data = await getSubscription();
  if (!data) return <NoAccess home="/dashboard" />;
  const manage = data.can_manage && data.subscription !== null && data.subscription.status !== "canceled";
  return (
    <Card>
      <AddonsTable data={data} manage={manage} />
    </Card>
  );
}
