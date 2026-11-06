import { CalendarCheck, CalendarOff, Hourglass, TimerOff } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { Tabs } from "@/components/ui/Tabs";
import { TintTile } from "@/components/ui/Tinted";
import { ExpireHoldsAction, HoldCreateAction, RangeCreateAction } from "@/features/catalog-availability/AvailabilityForms";
import { HoldsTable, RangesTable } from "@/features/catalog-availability/AvailabilityTables";
import type { AvailabilityOverview } from "@/lib/catalog-availability";
import { formatDate } from "@/lib/format";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Cupos y bloqueos" };

export default async function CuposPage() {
  const overview = await getResource<AvailabilityOverview>("/catalog/availability", "No pudimos cargar los cupos.");

  if (!overview) {
    return <PageHeader title="Cupos y bloqueos" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const open = overview.ranges.filter((range) => range.status === "disponible" && range.phase === "en_curso");
  const closures = overview.ranges.filter((range) => range.status !== "disponible" && range.phase !== "pasado").sort((a, b) => a.date_from.localeCompare(b.date_from));
  const active = overview.holds.filter((hold) => hold.status === "hold" && !hold.expired);
  const expired = overview.holds.filter((hold) => hold.expired);

  return (
    <>
      <PageHeader
        title="Cupos y bloqueos"
        subtitle="Cuántos cupos vende cada producto por día y quién está reteniendo lugares."
        info={<InfoTip>Un bloqueo resta cupos libres hasta que se confirma, se libera o vence. Los vencidos siguen restando hasta que se expiran.</InfoTip>}
        actions={
          <>
            {overview.can.manage_holds && expired.length > 0 && <ExpireHoldsAction count={expired.length} />}
            {overview.can.manage_ranges && <RangeCreateAction overview={overview} />}
            {overview.can.manage_holds && <HoldCreateAction overview={overview} />}
          </>
        }
      />
      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TintTile icon={CalendarCheck} tone="ok" label="Productos con venta abierta" value={new Set(open.map((range) => range.product.id)).size} note={`${open.reduce((sum, range) => sum + range.capacity_per_day, 0)} cupos por día hoy`} />
        <TintTile icon={CalendarOff} tone="bad" label="Cierres programados" value={closures.length} note={closures[0] ? `Próximo: ${closures[0].product.name}, ${formatDate(closures[0].date_from)}` : "Sin cierres a la vista"} />
        <TintTile icon={Hourglass} tone="sun" label="Cupos en hold" value={active.reduce((sum, hold) => sum + hold.quantity, 0)} note={`${active.length} bloqueos vigentes`} />
        <TintTile icon={TimerOff} tone="violet" label="Bloqueos vencidos" value={expired.length} note={expired.length ? "Siguen restando cupos" : "Todo al día"} />
      </section>
      <Card padded={false}>
        <Tabs
          tabs={[
            { id: "rangos", label: "Disponibilidad por fechas", count: overview.ranges.length, content: <RangesTable overview={overview} /> },
            { id: "bloqueos", label: "Bloqueos", count: overview.holds.length, content: <HoldsTable overview={overview} /> },
          ]}
        />
      </Card>
    </>
  );
}
