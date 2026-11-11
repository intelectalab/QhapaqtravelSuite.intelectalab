import type { Metadata } from "next";
import { DeparturesCalendar } from "@/features/catalog-departures/DeparturesCalendar";
import { getDepartures } from "@/lib/server/catalog-board";

export const metadata: Metadata = { title: "Calendario de salidas" };

export default async function SalidasCalendarioPage() {
  const { departures } = await getDepartures();
  if (!departures) return null;
  return <DeparturesCalendar overview={departures} />;
}
