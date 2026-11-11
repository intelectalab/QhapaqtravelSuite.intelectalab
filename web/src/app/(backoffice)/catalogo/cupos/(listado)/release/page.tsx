import type { Metadata } from "next";
import { ReleaseAlertsTable } from "@/features/catalog-allotments/AllotmentBoard";
import { getAllotments } from "@/lib/server/allotments";

export const metadata: Metadata = { title: "Alertas de release" };

export default async function CuposReleasePage() {
  const overview = await getAllotments();
  if (!overview) return null;
  return <ReleaseAlertsTable overview={overview} />;
}
