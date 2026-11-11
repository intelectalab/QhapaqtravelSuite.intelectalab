import type { Metadata } from "next";
import { PassengerAlertsView } from "@/features/portal/PassengerTripViews";
import type { PaxAlerts } from "@/lib/portal";
import { passengerData, PORTAL_HOME } from "@/lib/server/portal";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Avisos de tu viaje" };

export default async function PortalAlertsPage({ searchParams }: PageProps<"/portal/avisos">) {
  const { trip } = await searchParams;
  const data = await passengerData<PaxAlerts>(`/alerts${typeof trip === "string" ? `?trip=${encodeURIComponent(trip)}` : ""}`, "No pudimos cargar los avisos.");
  if (!data) redirect(PORTAL_HOME);
  return <PassengerAlertsView data={data} />;
}
