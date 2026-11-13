import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PassengerDocumentsView } from "@/features/portal/PassengerServices";
import type { PaxDocuments } from "@/lib/portal";
import { passengerData, PORTAL_HOME } from "@/lib/server/portal";

export const metadata: Metadata = { title: "Documentos del viaje" };

export default async function PassengerDocumentsPage() {
  const data = await passengerData<PaxDocuments>("/documents", "No pudimos cargar tus documentos.");
  if (!data) redirect(PORTAL_HOME);
  return <PassengerDocumentsView data={data} />;
}
