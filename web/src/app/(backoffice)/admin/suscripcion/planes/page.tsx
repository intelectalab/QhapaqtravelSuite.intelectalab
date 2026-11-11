import type { Metadata } from "next";
import { NoAccess } from "@/components/shell/NoAccess";
import { PlanCoverage } from "@/features/admin/PlanViews";
import { getPlanRules, getSubscription } from "@/lib/server/subscription";

export const metadata: Metadata = { title: "Tu plan" };

export default async function PlanesPage() {
  const [data, rules] = await Promise.all([getSubscription(), getPlanRules()]);
  if (!data || !rules) return <NoAccess home="/dashboard" />;
  const manage = data.can_manage && data.subscription !== null && data.subscription.status !== "canceled";
  return <PlanCoverage rules={rules} cycle={data.subscription?.cycle ?? "monthly"} manage={manage} />;
}
