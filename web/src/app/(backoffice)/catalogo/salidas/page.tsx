import { BarChart3, CalendarDays, Hourglass, Ticket, Users } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { BarChart } from "@/components/ui/Charts";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { DepartureCreateAction } from "@/features/catalog-departures/DepartureForms";
import { DeparturesTable } from "@/features/catalog-departures/DeparturesTable";
import type { DeparturesOverview } from "@/lib/catalog-departures";
import { monthName } from "@/lib/format";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Salidas y disponibilidad" };

export default async function SalidasPage() {
  const overview = await getResource<DeparturesOverview>("/catalog/departures", "No pudimos cargar las salidas.");

  if (!overview) {
    return <PageHeader title="Salidas y disponibilidad" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const upcoming = overview.departures.filter((departure) => departure.future && departure.status !== "cancelada");
  const capacity = upcoming.reduce((sum, departure) => sum + departure.capacity, 0);
  const sold = upcoming.reduce((sum, departure) => sum + departure.sold, 0);
  const held = upcoming.reduce((sum, departure) => sum + departure.held, 0);
  const free = upcoming.reduce((sum, departure) => sum + departure.available, 0);
  const months = [...new Set(upcoming.map((departure) => departure.date.slice(0, 7)))].sort().slice(0, 6);
  const chart = months.map((month, index) => {
    const rows = upcoming.filter((departure) => departure.date.startsWith(month));
    const seats = rows.reduce((sum, departure) => sum + departure.capacity, 0);
    const taken = rows.reduce((sum, departure) => sum + departure.sold + departure.held, 0);
    const pct = seats ? Math.round((taken / seats) * 100) : 0;
    return { label: monthName(`${month}-01`).slice(0, 3), value: pct, caption: `${pct} %`, detail: `${rows.length} salidas · ${taken} de ${seats} cupos`, highlight: index === 0 };
  });

  return (
    <>
      <PageHeader
        title="Salidas y disponibilidad"
        subtitle="Fechas programadas con su capacidad, lo vendido y lo que queda libre."
        info={<InfoTip>Libres = capacidad − vendidos − bloqueos en hold. Las reservas confirmadas suman a vendidos y una salida abierta pasa sola a completa cuando se llena.</InfoTip>}
        actions={overview.can.manage ? <DepartureCreateAction overview={overview} /> : undefined}
      />
      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TintTile icon={CalendarDays} tone="t1" label="Próximas salidas" value={upcoming.length} note={`${capacity} cupos programados`} />
        <TintTile icon={Users} tone="ok" label="Vendidos" value={sold} note={capacity ? `${Math.round((sold / capacity) * 100)} % de ocupación` : "Sin capacidad"} />
        <TintTile icon={Hourglass} tone="sun" label="En hold" value={held} note="Retenidos por cotizaciones y agencias" />
        <TintTile icon={Ticket} tone="violet" label="Libres" value={free} note={`En ${upcoming.filter((departure) => departure.available > 0).length} salidas con cupo`} />
      </section>
      {chart.length > 1 && (
        <Card className="mb-5">
          <TintCardTitle icon={BarChart3} title="Ocupación por mes" aside="Vendidos y en hold sobre capacidad" />
          <BarChart data={chart} height={110} />
        </Card>
      )}
      <Card>
        <DeparturesTable overview={overview} />
      </Card>
    </>
  );
}
