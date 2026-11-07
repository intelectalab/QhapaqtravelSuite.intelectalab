import type { Metadata } from "next";
import { PortalTripDetail } from "@/features/portal/PortalTripDetail";
import type { PortalTrip } from "@/lib/portal";
import { portalData, portalSession } from "@/lib/server/portal";

export const metadata: Metadata = { title: "Mi viaje" };

export default async function PortalTripPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [session, trip] = await Promise.all([portalSession(), portalData<PortalTrip>(`/reservations/${encodeURIComponent(code)}`, "No pudimos cargar tu viaje.")]);
  return <PortalTripDetail trip={trip} passenger={session?.role === "passenger"} />;
}
