import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { ReservationsTable } from "@/features/reservations/ReservationsTable";
import { listReservations } from "@/lib/server/reservations";

export const metadata: Metadata = { title: "Reservas" };

export default async function ReservasPage() {
  const { items, today } = await listReservations();

  return (
    <>
      <PageHeader title="Reservas" subtitle="Viajes vendidos, sus pasajeros y lo que falta cobrar." />
      <ReservationsTable rows={items} today={today} />
    </>
  );
}
