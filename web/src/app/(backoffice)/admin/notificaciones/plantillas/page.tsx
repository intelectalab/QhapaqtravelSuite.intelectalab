import type { Metadata } from "next";
import { NotificationTemplatesTable } from "@/features/admin/Notifications";
import { getNotifications } from "@/lib/server/adminSections";

export const metadata: Metadata = { title: "Plantillas de avisos" };

export default async function NotificacionesPlantillasPage() {
  const data = await getNotifications();
  if (!data) return null;
  return <NotificationTemplatesTable data={data} />;
}
