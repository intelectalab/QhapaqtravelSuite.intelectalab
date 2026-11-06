import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { BillingTabs } from "@/features/platform/BillingTabs";
import { FlagsMatrix, OverrideFormAction, OverridesList } from "@/features/platform/FlagsMatrix";
import { getFlags } from "@/lib/server/platformConsole";

export const metadata: Metadata = { title: "Funcionalidades por plan" };

export default async function FlagsPage() {
  const overview = await getFlags();

  return (
    <>
      <PageHeader
        title="Facturación"
        subtitle="Qué funcionalidades incluye cada plan y las excepciones concedidas a agencias puntuales."
        info={<InfoTip>Prioridad: excepción vigente de la agencia, luego complemento contratado y por último el plan. El servidor valida cada acceso; el menú solo refleja el resultado.</InfoTip>}
        actions={<OverrideFormAction overview={overview} />}
      />
      <BillingTabs />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <FlagsMatrix overview={overview} />
        <div className="xl:sticky xl:top-4 xl:self-start">
          <OverridesList overrides={overview.overrides} />
        </div>
      </div>
    </>
  );
}
