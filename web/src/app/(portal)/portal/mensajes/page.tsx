import type { Metadata } from "next";
import { PortalMessagesView } from "@/features/portal/PortalMessagesView";
import type { PortalMessages } from "@/lib/portal";
import { portalData, portalSession } from "@/lib/server/portal";

export const metadata: Metadata = { title: "Mensajes" };

export default async function PortalMessagesPage() {
  const [session, data] = await Promise.all([portalSession(), portalData<PortalMessages>("/tickets", "No pudimos cargar tus mensajes.")]);
  return <PortalMessagesView data={data} passenger={session?.role === "passenger"} clientName={session?.client.name ?? ""} />;
}
