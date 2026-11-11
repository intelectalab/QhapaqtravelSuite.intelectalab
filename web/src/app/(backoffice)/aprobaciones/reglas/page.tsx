import type { Metadata } from "next";
import { ApprovalsWorkspace } from "@/features/approvals/ApprovalsWorkspace";
import type { ApprovalsOverview } from "@/lib/approvals";
import { getCachedResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Reglas de aprobación" };

export default async function SectionPage() {
  const overview = await getCachedResource<ApprovalsOverview>("/approvals", "No pudimos cargar la bandeja de aprobaciones.");
  if (!overview) return null;
  return <ApprovalsWorkspace overview={overview} section="rules" />;
}
