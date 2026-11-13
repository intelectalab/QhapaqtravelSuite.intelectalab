import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { FeesTable, GatewayCards, GatewayFormAction, GatewayTiles, ImportAction, Simulator } from "@/features/vitrina/Gateways";
import { getResource } from "@/lib/server/resource";
import type { GatewayFeesOverview, GatewaysOverview } from "@/lib/vitrina";

export const metadata: Metadata = { title: "Pasarelas y comisiones" };

export default async function GatewaysPage() {
  const [overview, fees] = await Promise.all([
    getResource<GatewaysOverview>("/finance/gateways", "No pudimos cargar las pasarelas."),
    getResource<GatewayFeesOverview>("/finance/gateway-fees", "No pudimos cargar las comisiones."),
  ]);

  if (!overview || !fees) {
    return <PageHeader title="Pasarelas y comisiones" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  return (
    <>
      <PageHeader
        title="Pasarelas y comisiones"
        subtitle="Cada cobro guarda el bruto, la comisión de la pasarela, su IGV y el neto que llega al banco."
        info={<InfoTip>La comisión configurada es una estimación; al importar el reporte de liquidación se reemplaza por la real. PayPal se habilita con el add-on «Cobros con PayPal».</InfoTip>}
        actions={overview.can_manage ? <><ImportAction gateways={overview.items} /><GatewayFormAction overview={overview} /></> : undefined}
      />
      <GatewayTiles fees={fees} />
      <GatewayCards overview={overview} />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <FeesTable fees={fees} gateways={overview.items} />
        <Simulator gateways={overview.items} />
      </div>
    </>
  );
}
