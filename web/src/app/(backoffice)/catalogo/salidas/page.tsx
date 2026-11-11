import type { Metadata } from "next";
import { DeparturesTable } from "@/features/catalog-departures/DeparturesTable";
import { getDepartures } from "@/lib/server/catalog-board";

export const metadata: Metadata = { title: "Programación de salidas" };

export default async function SalidasPage() {
  const { departures, availability } = await getDepartures();
  if (!departures) return null;
  return (
    <div className="p-5">
      <DeparturesTable overview={departures} availability={availability} />
    </div>
  );
}
