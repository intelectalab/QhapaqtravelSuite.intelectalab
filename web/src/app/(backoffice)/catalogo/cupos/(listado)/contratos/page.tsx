import type { Metadata } from "next";
import { ContractsTable } from "@/features/catalog-allotments/AllotmentBoard";
import { getAllotments } from "@/lib/server/allotments";

export const metadata: Metadata = { title: "Contratos de cupo" };

export default async function CuposContratosPage() {
  const overview = await getAllotments();
  if (!overview) return null;
  return (
    <div className="p-5">
      <ContractsTable overview={overview} />
    </div>
  );
}
