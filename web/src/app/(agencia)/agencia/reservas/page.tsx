import type { Metadata } from "next";
import { AgencyReservations } from "@/features/b2b-portal/AgencyReservations";
import type { AgencyReservationRow } from "@/lib/b2b-portal";
import { agencyData } from "@/lib/server/b2b-portal";

export const metadata: Metadata = { title: "Mis reservas" };

export default async function AgencyReservationsPage() {
  const data = await agencyData<{ today: string; reservations: AgencyReservationRow[] }>("/reservations", "No pudimos cargar tus reservas.");
  if (!data) return null;
  return <AgencyReservations rows={data.reservations} today={data.today} />;
}
