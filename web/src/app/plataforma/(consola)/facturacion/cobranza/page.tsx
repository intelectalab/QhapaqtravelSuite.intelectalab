import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { BillingTabs } from "@/features/platform/BillingTabs";
import { DunningKpis, DunningList, DunningPolicyCard } from "@/features/platform/DunningBoard";
import { getDunning } from "@/lib/server/platformConsole";

export const metadata: Metadata = { title: "Cobranza" };

export default async function CobranzaPage() {
  const overview = await getDunning();

  return (
    <>
      <PageHeader
        title="Facturación"
        subtitle="Facturas con cobro rechazado: calendario de reintentos, prórrogas y suspensión."
        info={<InfoTip>La agencia se reactiva sola cuando paga toda su deuda, ya sea con un reintento aprobado o con un pago manual.</InfoTip>}
      />
      <BillingTabs />
      <DunningKpis items={overview.items} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <DunningList overview={overview} />
        <div className="xl:sticky xl:top-4 xl:self-start">
          <DunningPolicyCard policy={overview.policy} />
        </div>
      </div>
    </>
  );
}
