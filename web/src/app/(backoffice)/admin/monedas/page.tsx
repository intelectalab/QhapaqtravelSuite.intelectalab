import { History } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle } from "@/components/ui/Tinted";
import { FxCards, FxHistoryTable, FxRegisterAction } from "@/features/finance/FxRates";
import type { FxOverview } from "@/lib/finance";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Monedas y tipo de cambio" };

export default async function MonedasPage() {
  const overview = await getResource<FxOverview>("/finance/fx-rates", "No pudimos cargar el tipo de cambio.");

  if (!overview) {
    return <PageHeader title="Monedas y tipo de cambio" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  return (
    <>
      <PageHeader
        title="Monedas y tipo de cambio"
        subtitle={`Moneda principal: soles (${overview.base}). Cada documento guarda el tipo de cambio de su día.`}
        info={<InfoTip>Los reportes consolidan en soles con el tipo de cambio vigente. Las cotizaciones, reservas y comprobantes conservan el que tenían al emitirse.</InfoTip>}
        actions={overview.can_register ? <FxRegisterAction currencies={overview.currencies} /> : undefined}
      />
      <FxCards currencies={overview.currencies} />
      <Card>
        <TintCardTitle icon={History} title="Historial" aside={`${overview.history.length} registros`} />
        <FxHistoryTable rows={overview.history} />
      </Card>
    </>
  );
}
