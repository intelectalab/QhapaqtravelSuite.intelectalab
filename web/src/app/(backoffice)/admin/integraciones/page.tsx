import { PlugZap, Radio } from "lucide-react";
import type { Metadata } from "next";
import { TintTile } from "@/components/ui/Tinted";
import { AuditTrail } from "@/features/admin/AdminParts";
import { AdaptersGrid } from "@/features/admin/Integrations";
import { AgencyConnections } from "@/features/integrations/AgencyConnections";
import { formatDateTime } from "@/lib/format";
import { getIntegrations } from "@/lib/server/adminSections";
import { getAgencyMail, getReadiness } from "@/lib/server/integrations";

export const metadata: Metadata = { title: "Integraciones" };

export default async function IntegracionesPage({ searchParams }: PageProps<"/admin/integraciones">) {
  const [data, readiness, { conectar }] = await Promise.all([getIntegrations(), getReadiness(), searchParams]);
  if (!data) return null;
  const mail = readiness?.can_manage ? await getAgencyMail() : null;
  const live = data.adapters.filter((adapter) => adapter.status === "activo").length;
  const tested = data.adapters.filter((adapter) => adapter.last_test).sort((a, b) => (b.last_test?.at ?? "").localeCompare(a.last_test?.at ?? ""))[0];

  return (
    <>
      <section className="mb-5 grid gap-3 sm:grid-cols-2">
        <TintTile icon={Radio} tone="ok" label="En producción" value={`${live} de ${data.adapters.length}`} note="Integraciones activas" info={<p>Integraciones con estado activo frente al total de adaptadores de la agencia. Las demás siguen en pruebas o por validar.</p>} />
        <TintTile icon={PlugZap} tone={tested?.last_test?.ok === false ? "bad" : "t4"} label="Última prueba de conexión" value={tested?.last_test ? (tested.last_test.ok ? "Correcta" : "Fallida") : "Sin pruebas"} note={tested?.last_test ? `${tested.name} · ${formatDateTime(tested.last_test.at, false)}` : undefined} info={<p>Resultado de la prueba de conexión más reciente entre todas las integraciones.</p>} />
      </section>
      {readiness && <AgencyConnections items={readiness.items} mail={mail} manage={readiness.can_manage} openMail={conectar === "correo"} />}
      <AdaptersGrid data={data} />
      <div className="mt-5">
        <AuditTrail entries={data.history} empty="Aún no hay cambios en integraciones ni procesos." />
      </div>
    </>
  );
}
