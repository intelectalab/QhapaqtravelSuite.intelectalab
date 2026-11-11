import type { Metadata } from "next";
import { WebIntegrationWorkspace } from "@/features/channels/WebIntegration";
import type { WebOverview } from "@/lib/channels";
import { getCachedResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Dominios del widget" };

export default async function WebDomainsPage() {
  const overview = await getCachedResource<WebOverview>("/channels/widget", "No pudimos cargar la integración web.");
  if (!overview) return null;
  return <WebIntegrationWorkspace overview={overview} section="domains" />;
}
