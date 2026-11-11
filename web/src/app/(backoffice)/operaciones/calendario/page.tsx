import { CircleAlert, Clock3, Route, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { OpsCalendar } from "@/features/operations/Calendar";
import { formatDate } from "@/lib/format";
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
        subtitle="Servicios de las reservas activas y salidas programadas. Toca un evento para ver su detalle y asignar recursos."
        info={<InfoTip>El punto naranja y el borde discontinuo marcan servicios sin confirmar por el proveedor o sin guía, conductor ni vehículo, y salidas sin guía o sin vehículo.</InfoTip>}
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Route} tone="t1" label="Servicios del mes" value={data.kpis.services} info="Servicios de reservas no canceladas con fecha en el mes que estás viendo." />
        <TintTile icon={UsersRound} tone="ok" label="Salidas programadas" value={data.kpis.departures} info="Salidas de Catálogo, Salidas y disponibilidad, no canceladas, con fecha en el mes que estás viendo." />
        <TintTile icon={CircleAlert} tone="warn" label="Pendientes" value={data.kpis.pending} note="Proveedor o recursos" info="Servicios del mes sin confirmar por el proveedor o sin guía, conductor ni vehículo, más las salidas del mes sin guía o sin vehículo." />
        <TintTile icon={Clock3} tone="violet" label="Hoy" value={data.kpis.today} note={formatDate(data.today)} info="Servicios y salidas programados para hoy, de cualquier mes que estés viendo." />
      </section>
      <OpsCalendar key={data.month} data={data} />
    </>
  );
}
