import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { ReservationsTable } from "@/features/reservations/ReservationsTable";
import { listReservations } from "@/lib/server/reservations";

export const metadata: Metadata = { title: "Reservas" };

export default async function ReservasPage() {
  const { items, today, can, view } = await listReservations();

  return (
    <>
      <PageHeader
        title="Reservas"
        subtitle="Viajes vendidos, sus pasajeros y lo que falta cobrar."
        actions={
          can.create ? (
            <Link href="/reservas/nueva" data-testid="reservation-new" className="inline-flex h-10 items-center gap-2 rounded-control bg-brand px-4 text-[13.5px] font-semibold text-white shadow-[0_8px_18px_-10px_var(--brand)] transition-transform duration-300 hover:-translate-y-0.5">
              <Plus size={16} strokeWidth={2.4} />
              Nueva reserva
            </Link>
          ) : undefined
        }
      />
      <ReservationsTable rows={items} today={today} can={can} prices={view?.price ?? true} />
    </>
  );
}
