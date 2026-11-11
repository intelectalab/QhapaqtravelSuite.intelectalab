import type { Metadata } from "next";
import { NotificationLog } from "@/features/admin/Notifications";
import { getNotifications } from "@/lib/server/adminSections";

export const metadata: Metadata = { title: "Registro de envíos" };

export default async function NotificacionesEnviosPage() {
  const data = await getNotifications();
  if (!data) return null;
  return <NotificationLog data={data} />;
}
