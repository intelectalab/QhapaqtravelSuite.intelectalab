import type { Metadata } from "next";
import { RatesTable } from "@/features/catalog-rates/RatesTable";
import { getRates } from "@/lib/server/catalog-board";

export const metadata: Metadata = { title: "Tarifas consolidadas" };

export default async function TarifasPage() {
  const overview = await getRates();
  if (!overview) return null;
  return (
    <div className="p-5">
      <RatesTable overview={overview} />
    </div>
  );
}
