import type { Metadata } from "next";
import { PassengerAppScreen } from "@/features/mobile/PassengerAppScreen";

export const metadata: Metadata = { title: "Viaje del pasajero" };

export default async function PassengerTripPreviewPage({ searchParams }: PageProps<"/canales/portal-pasajero/viajes">) {
  const { reserva } = await searchParams;
  return <PassengerAppScreen code={typeof reserva === "string" ? reserva : ""} title="Viaje del pasajero" back={{ href: "/canales/portal-pasajero", label: "Portal del pasajero" }} />;
}
