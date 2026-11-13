import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PassengerServicesView } from "@/features/portal/PassengerServices";
import type { PaxSection } from "@/lib/portal";
import { passengerData, PORTAL_HOME } from "@/lib/server/portal";

export const metadata: Metadata = { title: "Actividades" };

export default async function PassengerActivitiesPage() {
  const data = await passengerData<PaxSection>("/activities", "No pudimos cargar tus actividades.");
  if (!data) redirect(PORTAL_HOME);
  return <PassengerServicesView data={data} />;
}
