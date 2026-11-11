import { BellRing } from "lucide-react";
import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { TintCardTitle } from "@/components/ui/Tinted";
import { AuditTrail } from "@/features/admin/AdminParts";
import { NotificationMatrix } from "@/features/admin/Notifications";
import { getNotifications } from "@/lib/server/adminSections";

export const metadata: Metadata = { title: "Matriz de avisos" };

export default async function NotificacionesMatrizPage() {
  const data = await getNotifications();
  if (!data) return null;

  return (
    <>
      <Card className="mb-5">
        <TintCardTitle icon={BellRing} title="Qué se avisa y por dónde" />
        <NotificationMatrix data={data} />
      </Card>
      <AuditTrail entries={data.history} empty="Las reglas de aviso aún no tienen cambios." />
    </>
  );
}
