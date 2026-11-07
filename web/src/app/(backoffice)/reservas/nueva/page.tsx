import type { Metadata } from "next";
import { NoAccess } from "@/components/shell/NoAccess";
import { PageHeader } from "@/components/shell/PageHeader";
import { DirectReservationForm } from "@/features/reservations/DirectReservationForm";
import { getDirectFormOptions } from "@/lib/server/reservations";

export const metadata: Metadata = { title: "Nueva reserva" };

export default async function NuevaReservaPage() {
  const options = await getDirectFormOptions();
  if (!options) return <NoAccess home="/reservas" />;

  return (
    <>
      <PageHeader back={{ href: "/reservas", label: "Reservas" }} jump={false} title="Nueva reserva" subtitle="Venta directa, sin cotización. El precio sale de la tarifa vigente y la disponibilidad de la salida." />
      <DirectReservationForm options={options} />
    </>
  );
}
