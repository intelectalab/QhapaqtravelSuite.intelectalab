import type { Metadata } from "next";
import { PickupReport } from "@/features/catalog-allotments/AllotmentBoard";
import type { AllotmentPickup } from "@/lib/catalog-allotments";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Ritmo de ventas de cupos" };

export default async function CuposPickupPage() {
  const pickup = await getResource<AllotmentPickup>("/catalog/allotments/pickup", "No pudimos cargar el ritmo de ventas.");
  if (!pickup) return null;
  return <PickupReport pickup={pickup} />;
}
