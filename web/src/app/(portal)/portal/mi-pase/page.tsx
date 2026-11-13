import type { Metadata } from "next";
import { PassengerPassView } from "@/features/growth-ops/PassengerPass";
import type { PassengerPasses } from "@/lib/growth-ops";
import { passengerData } from "@/lib/server/portal";

export const metadata: Metadata = { title: "Mi pase" };

export default async function PassengerPassPage() {
  const data = await passengerData<PassengerPasses>("/passes", "No pudimos cargar tus pases.");
  if (!data) return <p className="rounded-xl bg-surface-2 px-4 py-10 text-center text-[13px] text-fg-3">Tus pases aún no están disponibles. Pide a la agencia que active el check-in con QR.</p>;
  return <PassengerPassView data={data} />;
}
