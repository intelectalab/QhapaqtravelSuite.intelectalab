import { CalendarCheck, CalendarDays, CircleAlert, Route } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { OpsCalendar } from "@/features/operations/Calendar";
import type { CalendarMonth } from "@/lib/operations";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Calendario operativo" };

export default async function CalendarioPage({ searchParams }: PageProps<"/operaciones/calendario">) {
  const { mes } = await searchParams;
  const month = typeof mes === "string" && /^\d{4}-\d{2}$/.test(mes) ? mes : null;
  const data = await getResource<CalendarMonth>(`/ops/calendar${month ? `?month=${month}` : ""}`, "No pudimos cargar el calendario.");

  if (!data) {
    return <PageHeader title="Calendario operativo" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  return (
    <>
      <PageHeader
        title="Calendario operativo"
        subtitle="Todos los servicios de las reservas activas, día por día."
        info={<InfoTip>El punto naranja marca días con servicios sin confirmar por el proveedor o sin guía, conductor ni vehículo.</InfoTip>}
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Route} tone="t1" label="Servicios del mes" value={data.kpis.services} />
        <TintTile icon={CircleAlert} tone="warn" label="Pendientes" value={data.kpis.pending} note="Proveedor o recursos" />
        <TintTile icon={CalendarCheck} tone="t4" label="Reservas operando" value={data.kpis.reservations} />
        <TintTile icon={CalendarDays} tone="violet" label="Días con actividad" value={data.kpis.busy_days} />
      </section>
      <OpsCalendar key={data.month} data={data} />
    </>
  );
}
