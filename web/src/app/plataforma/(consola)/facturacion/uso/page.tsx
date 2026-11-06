import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { BillingTabs } from "@/features/platform/BillingTabs";
import { UsageTable } from "@/features/platform/UsageTable";
import { monthName } from "@/lib/format";
import { getUsage } from "@/lib/server/platformConsole";

export const metadata: Metadata = { title: "Uso por agencia" };

export default async function UsoPage() {
  const usage = await getUsage();

  return (
    <>
      <PageHeader
        title="Facturación"
        subtitle={`Consumo de ${monthName(usage.month)} frente a los límites del plan y sus complementos.`}
        info={<InfoTip>Solo contadores: usuarios, almacenamiento, reservas, mensajes y llamadas a la API. La consola no muestra clientes, reservas ni montos de venta de las agencias.</InfoTip>}
      />
      <BillingTabs />
      <UsageTable items={usage.items} />
    </>
  );
}
