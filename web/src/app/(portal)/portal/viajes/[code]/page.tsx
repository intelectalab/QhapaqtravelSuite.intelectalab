import type { Metadata } from "next";
import { TripSectionNav } from "@/features/portal/PassengerServices";
import { PortalInTrip } from "@/features/portal/PortalInTrip";
import { PortalTripDetail } from "@/features/portal/PortalTripDetail";
import type { PortalTrip } from "@/lib/portal";
import { getResource } from "@/lib/server/resource";
import { portalData, portalSession } from "@/lib/server/portal";
import type { InTripAvailable } from "@/lib/trip";

export const metadata: Metadata = { title: "Mi viaje" };

export default async function PortalTripPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const [session, trip] = await Promise.all([portalSession(), portalData<PortalTrip>(`/reservations/${encodeURIComponent(code)}`, "No pudimos cargar tu viaje.")]);
  const passenger = session?.role === "passenger";
  const inTrip = passenger ? null : await getResource<InTripAvailable>(`/portal/client/reservations/${encodeURIComponent(code)}/in-trip`, "No pudimos cargar lo que puedes agregar en ruta.");
  const detail = <PortalTripDetail trip={trip} passenger={passenger} extra={inTrip ? <PortalInTrip code={trip.code} data={inTrip} /> : undefined} />;
  if (!passenger) return detail;
  return (
    <>
      <TripSectionNav trip={trip.code} />
      {detail}
    </>
  );
}
