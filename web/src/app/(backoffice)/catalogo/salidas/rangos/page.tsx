import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RangeCreateAction } from "@/features/catalog-availability/AvailabilityForms";
import { RangesTable } from "@/features/catalog-availability/AvailabilityTables";
import { getDepartures } from "@/lib/server/catalog-board";

export const metadata: Metadata = { title: "Rangos de venta" };

export default async function SalidasRangosPage() {
  const { availability } = await getDepartures();
  if (!availability) notFound();
  return (
    <div className="p-5">
      <RangesTable overview={availability} toolbarEnd={availability.can.manage_ranges ? <RangeCreateAction overview={availability} /> : undefined} />
    </div>
  );
}
