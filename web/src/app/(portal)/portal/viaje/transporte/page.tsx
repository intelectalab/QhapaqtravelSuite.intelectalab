import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PassengerServicesView } from "@/features/portal/PassengerServices";
import type { PaxSection } from "@/lib/portal";
import { passengerData, PORTAL_HOME } from "@/lib/server/portal";

export const metadata: Metadata = { title: "Transporte" };

export default async function PassengerTransportPage() {
  const data = await passengerData<PaxSection>("/transport", "No pudimos cargar tus traslados.");
  if (!data) redirect(PORTAL_HOME);
  return <PassengerServicesView data={data} />;
}
