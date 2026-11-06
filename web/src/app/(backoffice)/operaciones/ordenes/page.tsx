import { CalendarClock, CalendarDays, PlayCircle, Siren, UserRoundX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { Notice } from "@/features/operations/OpsBits";
import { OrderCreateAction, OrdersTable } from "@/features/operations/Orders";
import type { OrderList } from "@/lib/operations";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Órdenes operativas" };

export default async function OrdenesPage() {
  const data = await getResource<OrderList>("/ops/orders", "No pudimos cargar las órdenes operativas.");

  if (!data) {
    return <PageHeader title="Órdenes operativas" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const { kpis } = data;

  return (
    <>
      <PageHeader
        title="Órdenes operativas"
        subtitle="La ejecución de cada reserva confirmada: recursos, tareas e incidencias."
        info={<InfoTip>Una reserva confirmada genera una sola orden. Al crearla se copian sus tours y traslados para asignarles guía, conductor y vehículo.</InfoTip>}
        actions={data.can.assign ? <OrderCreateAction candidates={data.candidates} coordinators={data.coordinators} viewerId={data.viewer_id} /> : undefined}
      />

      {kpis.critical_incidents > 0 && (
        <Notice tone="bad" icon={<Siren size={16} />} action={<Link href="/operaciones/incidencias" className="text-[13px] font-semibold text-[var(--tint)] hover:underline">Ver incidencias</Link>}>
          <b className="font-semibold">{kpis.critical_incidents === 1 ? "Hay una incidencia crítica abierta." : `Hay ${kpis.critical_incidents} incidencias críticas abiertas.`}</b> Gerencia ya fue alertada; revisa el plan de contingencia.
        </Notice>
      )}

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={PlayCircle} tone="t4" label="En ejecución" value={kpis.running} note="Pasajeros en destino" />
        <TintTile icon={UserRoundX} tone="warn" label="Servicios sin recursos" value={kpis.pending_assignment} note="En órdenes activas" />
        <TintTile icon={CalendarDays} tone="t1" label="Servicios hoy" value={kpis.services_today} note={`${kpis.services_tomorrow} mañana`} />
        <TintTile icon={CalendarClock} tone="bad" label="Incidencias abiertas" value={kpis.open_incidents} note={kpis.critical_incidents > 0 ? `${kpis.critical_incidents} críticas` : "Ninguna crítica"} />
      </section>

      <OrdersTable data={data} />
    </>
  );
}
