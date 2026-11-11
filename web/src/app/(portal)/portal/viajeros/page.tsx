import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CompanionsForm } from "@/features/portal/PassengerTripViews";
import type { PaxCompanions } from "@/lib/portal";
import { passengerData, PORTAL_HOME } from "@/lib/server/portal";

export const metadata: Metadata = { title: "Viajeros y recojo" };

export default async function PortalCompanionsPage({ searchParams }: PageProps<"/portal/viajeros">) {
  const { trip } = await searchParams;
  const data = await passengerData<PaxCompanions>(`/companions${typeof trip === "string" ? `?trip=${encodeURIComponent(trip)}` : ""}`, "No pudimos cargar los viajeros.");
  if (!data) redirect(PORTAL_HOME);
  return <CompanionsForm key={data.lock_version} data={data} />;
}
