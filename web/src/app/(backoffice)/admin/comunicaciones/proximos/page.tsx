import type { Metadata } from "next";
import { PaxMessagesTable } from "@/features/admin/PaxTemplates";
import { getPassengerMessaging } from "@/lib/server/adminSections";

export const metadata: Metadata = { title: "Próximos envíos" };

export default async function ComunicacionesProximosPage() {
  const loaded = await getPassengerMessaging();
  if (!loaded) return null;
  const rows = loaded.messages.filter((message) => message.status === "programado").sort((a, b) => (a.scheduled_at ?? a.at).localeCompare(b.scheduled_at ?? b.at));
  return <PaxMessagesTable messages={rows} channels={loaded.data.channels} data={loaded.data} mode="upcoming" />;
}
