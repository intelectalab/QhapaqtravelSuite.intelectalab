import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { PlansTable } from "@/features/platform/PlansTable";
import { listPlans } from "@/lib/server/platform";

export const metadata: Metadata = { title: "Planes" };

export default async function PlanesPage() {
  const plans = await listPlans();

  return (
    <>
      <PageHeader
        title="Planes"
        subtitle="Lo que puede contratar cada agencia: precio, módulos y límites."
        info={<InfoTip>Los límites marcados con el símbolo de infinito no tienen tope. Los precios no incluyen IGV.</InfoTip>}
      />
      <PlansTable plans={plans} />
    </>
  );
}
