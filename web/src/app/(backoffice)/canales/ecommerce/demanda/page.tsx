import type { Metadata } from "next";
import { UnmetDemandSection } from "@/features/channels/UnmetDemand";
import { getEcommerce } from "@/lib/server/ecommerce";

export const metadata: Metadata = { title: "Demanda sin cupo" };

export default async function EcommerceDemandPage() {
  const { overview } = await getEcommerce();
  if (!overview) return null;
  return <UnmetDemandSection demand={overview.unmet_demand} />;
}
