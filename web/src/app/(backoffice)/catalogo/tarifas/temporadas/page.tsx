import type { Metadata } from "next";
import { SeasonsBoard } from "@/features/catalog-rates/SeasonsBoard";
import { getRates } from "@/lib/server/catalog-board";

export const metadata: Metadata = { title: "Temporadas" };

export default async function TemporadasPage() {
  const overview = await getRates();
  if (!overview) return null;
  return (
    <div className="p-5">
      <SeasonsBoard overview={overview} />
    </div>
  );
}
