import type { Metadata } from "next";
import { PassengerAppScreen } from "@/features/mobile/PassengerAppScreen";

export const metadata: Metadata = { title: "App pasajero" };

export default async function PassengerAppPage({ searchParams }: PageProps<"/mobile/pasajero">) {
  const { reserva } = await searchParams;
  return <PassengerAppScreen code={typeof reserva === "string" ? reserva : ""} title="App pasajero" />;
}
