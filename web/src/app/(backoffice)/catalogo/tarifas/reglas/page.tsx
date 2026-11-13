import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PricingChain, PricingRulesBoard } from "@/features/catalog-rates/PricingRules";
import { getPricing } from "@/lib/server/catalog-board";

export const metadata: Metadata = { title: "Reglas de pricing" };

export default async function ReglasPage() {
  const pricing = await getPricing();
  if (!pricing) notFound();
  return (
    <div className="p-5">
      <PricingChain />
      <PricingRulesBoard overview={pricing} />
    </div>
  );
}
