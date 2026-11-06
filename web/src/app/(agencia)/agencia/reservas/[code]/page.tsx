import type { Metadata } from "next";
import { AgencyReservationDetail } from "@/features/b2b-portal/AgencyReservationDetail";
import type { AgencyReservation } from "@/lib/b2b-portal";
import { agencyData } from "@/lib/server/b2b-portal";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  return { title: (await params).code };
}

export default async function AgencyReservationPage({ params, searchParams }: { params: Promise<{ code: string }>; searchParams: Promise<{ creada?: string; cancelar?: string }> }) {
  const [{ code }, query] = await Promise.all([params, searchParams]);
  const reservation = await agencyData<AgencyReservation>(`/reservations/${encodeURIComponent(code)}`, "No pudimos cargar la reserva.");
  if (!reservation) return null;
  return <AgencyReservationDetail reservation={reservation} created={query.creada === "1"} openCancel={query.cancelar === "1"} />;
}
