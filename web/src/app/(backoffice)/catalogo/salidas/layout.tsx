import { ConsultModeNotice } from "@/components/ui/ConsultMode";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { ExpireHoldsAction, HoldCreateAction } from "@/features/catalog-availability/AvailabilityForms";
import { DepartureCreateAction } from "@/features/catalog-departures/DepartureForms";
import { getDepartures } from "@/lib/server/catalog-board";

export default async function SalidasLayout({ children }: { children: ReactNode }) {
  const { departures: overview, availability } = await getDepartures();
  if (!overview) return <PageHeader title="Salidas y disponibilidad" subtitle="Tu rol no tiene acceso a esta sección." />;

  const expired = availability?.holds.filter((hold) => hold.expired).length ?? 0;

  return (
    <>
      <PageHeader
        title="Salidas y disponibilidad"
        subtitle="Fechas programadas con su capacidad, lo vendido, lo retenido y lo que queda libre."
        info={<InfoTip>Libres = capacidad − vendidos − bloqueos en hold. Las reservas confirmadas suman a vendidos y una salida abierta pasa sola a completa cuando se llena.</InfoTip>}
        actions={
          <>
            {availability?.can.manage_holds && expired > 0 && <ExpireHoldsAction count={expired} />}
            {availability?.can.manage_holds && <HoldCreateAction overview={availability} />}
            {overview.can.manage && <DepartureCreateAction overview={overview} />}
          </>
        }
      />
      <ConsultModeNotice permissions={["catalog.products.manage_availability"]} what="programar salidas ni retener cupos" />
      <TabbedCard
        tabs={[
          { href: "/catalogo/salidas", label: "Programación" },
          { href: "/catalogo/salidas/calendario", label: "Calendario" },
          ...(availability
            ? [
                { href: "/catalogo/salidas/holds", label: "Holds de disponibilidad" },
                { href: "/catalogo/salidas/rangos", label: "Rangos de venta" },
              ]
            : []),
        ]}
      >
        {children}
      </TabbedCard>
    </>
  );
}
