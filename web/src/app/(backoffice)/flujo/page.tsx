import { Percent, Route, Target, Trophy } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { ProcessFlow } from "@/features/reports/ProcessFlow";
import type { ProcessMapData } from "@/lib/reports";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Mapa de procesos" };

export default async function FlujoPage() {
  const data = await getResource<ProcessMapData>("/reports/process-map", "No pudimos cargar el mapa de procesos.");

  if (!data) {
    return <PageHeader title="Mapa de procesos" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const { conversion } = data;

  return (
    <>
      <PageHeader
        title="Mapa de procesos"
        subtitle={data.scope === "own" ? "El recorrido de tus ventas, de la primera consulta al cobro." : "El recorrido completo de una venta, de la primera consulta al cobro."}
        info={<InfoTip>Cada etapa muestra lo que hoy está en curso. Entre etapas verás la tasa de paso calculada con los registros reales.</InfoTip>}
      />
      <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <TintTile icon={Percent} tone="info" label="Leads que pasan a oportunidad" value={`${conversion.lead_to_opportunity} %`} />
        <TintTile icon={Trophy} tone="violet" label="Oportunidades ganadas" value={conversion.opportunity_win !== null ? `${conversion.opportunity_win} %` : "Sin cierres"} note="Sobre las cerradas" />
        <TintTile icon={Target} tone="ok" label="Cotizaciones convertidas en reserva" value={conversion.quote_to_reservation !== null ? `${conversion.quote_to_reservation} %` : "Sin datos"} />
      </section>
      <Card>
        <TintCardTitle icon={Route} title="Lead → oportunidad → cotización → reserva → operación → cobro" />
        <ProcessFlow data={data} />
      </Card>
    </>
  );
}
