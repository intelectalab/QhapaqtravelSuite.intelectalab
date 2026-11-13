import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { TripSectionNav } from "@/features/portal/PassengerServices";
import { PORTAL_HOME, portalSession } from "@/lib/server/portal";

export default async function PassengerTripLayout({ children }: { children: ReactNode }) {
  const session = await portalSession();
  if (session?.role !== "passenger") redirect(PORTAL_HOME);
  return (
    <>
      <TripSectionNav trip={session.trip} />
      {children}
    </>
  );
}
