import type { Metadata } from "next";
import { WebIntegrationWorkspace } from "@/features/channels/WebIntegration";
import type { WebOverview } from "@/lib/channels";
import { getCachedResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Eventos del sitio y el widget" };

export default async function WebEventsPage() {
  const overview = await getCachedResource<WebOverview>("/channels/widget", "No pudimos cargar la integración web.");
  if (!overview) return null;
  return <WebIntegrationWorkspace overview={overview} section="events" />;
}
