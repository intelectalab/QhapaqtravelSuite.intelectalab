import type { Metadata } from "next";
import { NoAccess } from "@/components/shell/NoAccess";
import { PlanComparison } from "@/features/admin/PlanViews";
import { getPlanRules, getSubscription } from "@/lib/server/subscription";

export const metadata: Metadata = { title: "Comparar planes" };

export default async function CompararPage() {
  const [data, rules] = await Promise.all([getSubscription(), getPlanRules()]);
  if (!data || !rules) return <NoAccess home="/dashboard" />;
  const manage = data.can_manage && data.subscription !== null && data.subscription.status !== "canceled";
  return <PlanComparison rules={rules} cycle={data.subscription?.cycle ?? "monthly"} manage={manage} />;
}
