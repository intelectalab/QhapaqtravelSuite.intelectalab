import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PortalTrips } from "@/features/portal/PortalTrips";
import type { PortalTripSummary } from "@/lib/portal";
import { portalData, portalSession } from "@/lib/server/portal";

export const metadata: Metadata = { title: "Mis viajes" };

export default async function PortalTripsPage() {
  const session = await portalSession();
  if (session?.role === "passenger" && session.trip) redirect(`/portal/viajes/${session.trip}`);
  const { trips } = await portalData<{ today: string; trips: PortalTripSummary[] }>("/reservations", "No pudimos cargar tus viajes.");
  return <PortalTrips trips={trips} />;
}
