import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { OccupancyView } from "@/features/reservations/OccupancyView";
import { cn } from "@/lib/cn";
import { DirectReservationWizardAction } from "@/features/reservations/DirectReservationWizard";
import { ReservationsTable } from "@/features/reservations/ReservationsTable";
import { getDirectFormOptions, getOccupancy, listReservations } from "@/lib/server/reservations";

export const metadata: Metadata = { title: "Reservas" };

export default async function ReservasPage({ searchParams }: PageProps<"/reservas">) {
  const { nueva, vista, mes } = await searchParams;
  const occupancyMode = vista === "ocupacion";
  const [{ items, today, can, view }, occupancy] = await Promise.all([listReservations(), occupancyMode ? getOccupancy(typeof mes === "string" ? mes : undefined) : Promise.resolve(null)]);
  const options = can.create ? await getDirectFormOptions() : null;
  const modes = [
    { href: "/reservas", label: "Lista", active: !occupancyMode },
    { href: "/reservas?vista=ocupacion", label: "Ocupación por fecha", active: occupancyMode },
  ];

  return (
    <>
      <PageHeader title="Reservas" subtitle="Viajes vendidos, sus pasajeros y lo que falta cobrar." actions={options ? <DirectReservationWizardAction options={options} defaultOpen={nueva === "1"} /> : undefined} />
      <nav aria-label="Vista de reservas" className="mb-4 inline-flex rounded-full border border-line bg-surface p-1 text-[13px]">
        {modes.map((mode) => (
          <Link key={mode.href} href={mode.href} aria-current={mode.active ? "page" : undefined} className={cn("rounded-full px-3.5 py-1.5 font-semibold transition-colors", mode.active ? "bg-accent text-white" : "text-fg-2 hover:text-fg")}>
            {mode.label}
          </Link>
        ))}
      </nav>
      {occupancy ? <OccupancyView data={occupancy} /> : <ReservationsTable rows={items} today={today} can={can} prices={view?.price ?? true} costs={view?.cost ?? false} />}
    </>
  );
}
