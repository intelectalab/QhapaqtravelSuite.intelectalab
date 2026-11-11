import type { Metadata } from "next";
import { PortalNotifications, type PortalNotification } from "@/features/portal/PortalInbox";
import { portalData } from "@/lib/server/portal";

export const metadata: Metadata = { title: "Notificaciones" };

export default async function PortalNotificationsPage() {
  const { items } = await portalData<{ items: PortalNotification[] }>("/notifications", "No pudimos cargar tus notificaciones.");
  return <PortalNotifications items={items} />;
}
