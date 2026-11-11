import type { Metadata } from "next";
import { PaxMessagesTable } from "@/features/admin/PaxTemplates";
import { getPassengerMessaging } from "@/lib/server/adminSections";

export const metadata: Metadata = { title: "Historial de mensajes" };

export default async function ComunicacionesHistorialPage() {
  const loaded = await getPassengerMessaging();
  if (!loaded) return null;
  return <PaxMessagesTable messages={loaded.messages.filter((message) => message.status !== "programado")} channels={loaded.data.channels} data={loaded.data} mode="history" />;
}
