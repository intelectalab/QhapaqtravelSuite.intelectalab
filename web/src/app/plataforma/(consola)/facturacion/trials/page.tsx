import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { BillingTabs } from "@/features/platform/BillingTabs";
import { TrialsBoard } from "@/features/platform/TrialsBoard";
import { getTrials } from "@/lib/server/platformConsole";

export const metadata: Metadata = { title: "Pruebas gratis" };

export default async function TrialsPage() {
  const overview = await getTrials();

  return (
    <>
      <PageHeader
        title="Facturación"
        subtitle="Agencias en periodo de prueba: extiende el plazo o conviértelas en suscripción."
        info={<InfoTip>Se avisa a la agencia 7, 3 y 1 día antes del vencimiento. Si vence sin tarjeta registrada, queda suspendida en solo lectura.</InfoTip>}
      />
      <BillingTabs />
      <TrialsBoard overview={overview} />
    </>
  );
}
