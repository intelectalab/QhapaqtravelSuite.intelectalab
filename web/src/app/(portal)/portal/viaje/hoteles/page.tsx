import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PassengerServicesView } from "@/features/portal/PassengerServices";
import type { PaxSection } from "@/lib/portal";
import { passengerData, PORTAL_HOME } from "@/lib/server/portal";

export const metadata: Metadata = { title: "Hoteles" };

export default async function PassengerHotelsPage() {
  const data = await passengerData<PaxSection>("/hotels", "No pudimos cargar tus hoteles.");
  if (!data) redirect(PORTAL_HOME);
  return <PassengerServicesView data={data} />;
}
