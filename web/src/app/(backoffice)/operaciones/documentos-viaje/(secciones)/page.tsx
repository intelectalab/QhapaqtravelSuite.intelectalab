import type { Metadata } from "next";
import { TravelDocsWorkspace } from "@/features/operations/TravelDocSections";
import type { TravelDocList } from "@/lib/operations";
import { getCachedResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Documentos de viaje" };

export default async function TravelDocsReservationsPage() {
  const data = await getCachedResource<TravelDocList>("/ops/travel-docs", "No pudimos cargar los documentos de viaje.");
  if (!data) return null;
  return <TravelDocsWorkspace data={data} section="reservations" />;
}
