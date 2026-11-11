import type { Metadata } from "next";
import { AuditTrail } from "@/features/admin/AdminParts";
import { PaxTemplatesTable, VariablesCard } from "@/features/admin/PaxTemplates";
import { getPassengerMessaging } from "@/lib/server/adminSections";

export const metadata: Metadata = { title: "Mensajes al pasajero" };

export default async function ComunicacionesPage() {
  const loaded = await getPassengerMessaging();
  if (!loaded) return null;
  const { data } = loaded;

  return (
    <>
      <PaxTemplatesTable data={data} />
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <VariablesCard data={data} />
        <AuditTrail entries={data.history} empty="Las plantillas aún no tienen cambios." />
      </div>
    </>
  );
}
