import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HoldsTable } from "@/features/catalog-availability/AvailabilityTables";
import { getDepartures } from "@/lib/server/catalog-board";

export const metadata: Metadata = { title: "Holds de disponibilidad" };

export default async function SalidasHoldsPage() {
  const { availability } = await getDepartures();
  if (!availability) notFound();
  return (
    <div className="p-5">
      <HoldsTable overview={availability} />
    </div>
  );
}
