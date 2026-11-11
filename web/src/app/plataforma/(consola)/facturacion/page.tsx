import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { BillingKpis, ChurnDetail, GrowthFlow, LifecycleFeed, MrrByPlan, MrrEvolution } from "@/features/platform/BillingOverview";
import { BillingTabs } from "@/features/platform/BillingTabs";
import { getBillingOverview } from "@/lib/server/platformConsole";

export const metadata: Metadata = { title: "Facturación" };

export default async function FacturacionPage() {
  const overview = await getBillingOverview();

  return (
    <>
      <PageHeader
        title="Facturación"
        subtitle="Lo que factura KipuControl Cloud a las agencias: ingreso recurrente, bajas y cobros pendientes."
        info={<InfoTip>El ingreso recurrente suma, sin IGV, el plan y los complementos de cada agencia al día o en cobranza. Los cobros fallidos se muestran con IGV, como en la factura. No incluye ventas ni datos comerciales de las agencias.</InfoTip>}
      />
      <BillingTabs />
      <BillingKpis overview={overview} />
      <div className="mb-5 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <MrrEvolution series={overview.series} />
        <GrowthFlow series={overview.series} />
      </div>
      <div className="mb-5 grid gap-5 lg:grid-cols-2">
        <MrrByPlan plans={overview.by_plan} total={overview.mrr} />
        <ChurnDetail churn={overview.churn} />
      </div>
      <LifecycleFeed events={overview.events} />
    </>
  );
}
