import { ConsultModeNotice } from "@/components/ui/ConsultMode";
import { CalendarDays, Hourglass, Ticket, Users } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { TintTile } from "@/components/ui/Tinted";
import { ExpireHoldsAction, HoldCreateAction } from "@/features/catalog-availability/AvailabilityForms";
import { DepartureCreateAction } from "@/features/catalog-departures/DepartureForms";
import { capitalize, monthName } from "@/lib/format";
import { getDepartures } from "@/lib/server/catalog-board";

export default async function SalidasLayout({ children }: { children: ReactNode }) {
  const { departures: overview, availability } = await getDepartures();
  if (!overview) return <PageHeader title="Salidas y disponibilidad" subtitle="Tu rol no tiene acceso a esta sección." />;

  const upcoming = overview.departures.filter((departure) => departure.future && departure.status !== "cancelada");
  const capacity = upcoming.reduce((sum, departure) => sum + departure.capacity, 0);
  const sold = upcoming.reduce((sum, departure) => sum + departure.sold, 0);
  const held = upcoming.reduce((sum, departure) => sum + departure.held, 0);
  const free = upcoming.reduce((sum, departure) => sum + departure.available, 0);
  const months = [...new Set(upcoming.map((departure) => departure.date.slice(0, 7)))].sort().slice(0, 6);
  const activeHolds = availability?.holds.filter((hold) => hold.status === "hold" && !hold.expired) ?? [];
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
      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TintTile icon={CalendarDays} tone="t1" label="Próximas salidas" value={upcoming.length} note={`${capacity} cupos programados`} info={<p>Salidas de hoy en adelante que no están canceladas, con la suma de su capacidad.</p>} />
        <TintTile
          icon={Users}
          tone="ok"
          label="Vendidos"
          value={sold}
          note={capacity ? `${Math.round((sold / capacity) * 100)} % de ocupación` : "Sin capacidad"}
          info={
            <div>
              <p>Cupos confirmados en las próximas salidas. Ocupación por mes, con lo retenido:</p>
              <ul className="mt-2 flex flex-col gap-1">
                {months.map((month) => {
                  const rows = upcoming.filter((departure) => departure.date.startsWith(month));
                  const seats = rows.reduce((sum, departure) => sum + departure.capacity, 0);
                  const taken = rows.reduce((sum, departure) => sum + departure.sold + departure.held, 0);
                  return (
                    <li key={month} className="flex justify-between gap-3">
                      <span>{capitalize(monthName(`${month}-01`))}</span>
                      <b>{seats ? Math.round((taken / seats) * 100) : 0} %</b>
                    </li>
                  );
                })}
              </ul>
            </div>
          }
        />
        <TintTile icon={Hourglass} tone="sun" label="En hold" value={held} note={availability ? `${activeHolds.length} bloqueos vigentes` : "Retenidos por cotizaciones y agencias"} info={<p>Cupos retenidos por bloqueos sin confirmar. Restan de los libres hasta que se confirman, se liberan o vencen; los vencidos siguen restando hasta que se expiran.</p>} />
        <TintTile icon={Ticket} tone="violet" label="Libres" value={free} note={`En ${upcoming.filter((departure) => departure.available > 0).length} salidas con cupo`} info={<p>Capacidad menos vendidos y holds en las próximas salidas abiertas.</p>} />
      </section>
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
