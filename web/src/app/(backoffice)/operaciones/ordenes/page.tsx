import { CalendarDays, CalendarRange, Siren, Truck, UserRoundX } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/Button";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { Notice } from "@/features/operations/OpsBits";
import { OrderCreateAction, OrdersTable } from "@/features/operations/Orders";
import { SupplierAlternativesNotice } from "@/features/operations/SupplierAlternatives";
import type { OrderList, SupplierAlternativeList } from "@/lib/operations";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Órdenes operativas" };

export default async function OrdenesPage() {
  const [data, alternatives] = await Promise.all([
    getResource<OrderList>("/ops/orders", "No pudimos cargar las órdenes operativas."),
    getResource<SupplierAlternativeList>("/ops/supplier-responses?filter[type]=alternativa&filter[review_status]=pendiente", "No pudimos cargar las alternativas de proveedores."),
  ]);

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
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button href="/operaciones/calendario" variant="secondary" icon={<CalendarRange size={16} />} iconOnlyOnMobile label="Calendario">
              Calendario
            </Button>
            <Button href="/operaciones/asignaciones" variant="secondary" icon={<Truck size={16} />} iconOnlyOnMobile label="Recursos">
              Recursos
            </Button>
            {data.can.assign && <OrderCreateAction candidates={data.candidates} coordinators={data.coordinators} viewerId={data.viewer_id} />}
          </div>
        }
      />

      {kpis.critical_incidents > 0 && (
        <Notice tone="bad" icon={<Siren size={16} />} action={<Link href="/operaciones/incidencias" className="text-[13px] font-semibold text-[var(--tint)] hover:underline">Ver incidencias</Link>}>
          <b className="font-semibold">{kpis.critical_incidents === 1 ? "Hay una incidencia crítica abierta." : `Hay ${kpis.critical_incidents} incidencias críticas abiertas.`}</b> Gerencia ya fue alertada; revisa el plan de contingencia.
        </Notice>
      )}

      {alternatives && <SupplierAlternativesNotice data={alternatives} scope="all" />}

      <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <TintTile icon={CalendarDays} tone="t1" label="Servicios hoy" value={kpis.services_today} note={`${kpis.services_tomorrow} mañana`} info={<p>Tours, traslados y entradas de las órdenes activas con fecha de hoy. La nota cuenta los de mañana.</p>} />
        <TintTile icon={UserRoundX} tone="warn" label="Servicios por asignar" value={kpis.pending_assignment} note="Falta guía, conductor o vehículo" info={<p>Servicios de órdenes activas que todavía no tienen recursos asignados. El filtro «Con servicios sin recursos» de abajo muestra las órdenes que los contienen.</p>} />
      </section>

      <OrdersTable data={data} />
    </>
  );
}
