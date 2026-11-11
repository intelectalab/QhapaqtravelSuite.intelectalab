import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { PlansSection } from "@/features/platform/PlansSection";
import { PlansTable } from "@/features/platform/PlansTable";
import { getPlanRules } from "@/lib/server/platformConsole";
import { listPlans } from "@/lib/server/platform";

export const metadata: Metadata = { title: "Planes" };

export default async function PlanesPage() {
  const [plans, rules] = await Promise.all([listPlans(), getPlanRules()]);

  return (
    <>
      <PageHeader
        title="Planes"
        subtitle="Lo que puede contratar cada agencia: precio, módulos y límites."
        info={<InfoTip>Los límites marcados con el símbolo de infinito no tienen tope. Los precios no incluyen IGV.</InfoTip>}
      />
      <PlansSection plans={plans.length} rules={rules.rules}>
        <PlansTable plans={plans} />
      </PlansSection>
    </>
  );
}
