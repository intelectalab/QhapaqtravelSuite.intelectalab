import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { DirectReservationWizardAction } from "@/features/reservations/DirectReservationWizard";
import { ReservationsTable } from "@/features/reservations/ReservationsTable";
import { getDirectFormOptions, listReservations } from "@/lib/server/reservations";

export const metadata: Metadata = { title: "Reservas" };

export default async function ReservasPage({ searchParams }: PageProps<"/reservas">) {
  const [{ items, today, can, view }, { nueva }] = await Promise.all([listReservations(), searchParams]);
  const options = can.create ? await getDirectFormOptions() : null;

  return (
    <>
      <PageHeader title="Reservas" subtitle="Viajes vendidos, sus pasajeros y lo que falta cobrar." actions={options ? <DirectReservationWizardAction options={options} defaultOpen={nueva === "1"} /> : undefined} />
      <ReservationsTable rows={items} today={today} can={can} prices={view?.price ?? true} />
    </>
  );
}
