import { BedDouble, CalendarDays, Camera, ClipboardCheck, ClipboardList, ListChecks, Route, ShieldCheck, Siren, TicketCheck, Truck, UserRound, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { SectionLayout, SectionNav } from "@/components/ui/SectionNav";
import { HeroBand, HeroChip, HeroPanel, Journey, TintTile, ToneScope } from "@/components/ui/Tinted";
import { OrderAdvanceActions } from "@/features/operations/OrderActions";
import { CloseSection, EvidenceTab, IncidentsSection, PassengersSection, RoomingSection, ServicesSection, TasksSection, VouchersSection } from "@/features/operations/OrderSections";
import { Notice } from "@/features/operations/OpsBits";
import { SupplierAlternativesNotice } from "@/features/operations/SupplierAlternatives";
import { OrderCancelAction, OrderEditAction } from "@/features/operations/Orders";
import { formatDate, shortName } from "@/lib/format";
import { ORDER_FLOW, type IncidentList, type OrderDetail, type SupplierAlternativeList, type VoucherOverview } from "@/lib/operations";
import { resolveSections } from "@/lib/sections";
import { getResource } from "@/lib/server/resource";
import { statusLabel, statusTone } from "@/lib/tone";

const getOrder = cache(async (code: string) => (await getResource<OrderDetail>(`/ops/orders/${encodeURIComponent(code)}`, "No pudimos cargar la orden.")) ?? notFound());

export async function generateMetadata({ params }: PageProps<"/operaciones/ordenes/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: (await getOrder(code)).title };
}

export default async function OrdenPage({ params, searchParams }: PageProps<"/operaciones/ordenes/[code]">) {
  const [{ code }, { seccion }] = await Promise.all([params, searchParams]);
  const order = await getOrder(code);
  const closed = ["completada", "cancelada"].includes(order.status);
  const editable = order.can.assign && !closed;
  const stepIndex = ORDER_FLOW.indexOf(order.status);
  const steps = ORDER_FLOW.map((status, index) => ({ label: statusLabel(status), at: index === ORDER_FLOW.length - 1 ? order.closed_at : null, done: order.status !== "cancelada" && index <= stepIndex }));
  const assigned = order.assignments.filter((item) => item.status !== "pendiente").length;
  const confirmedSuppliers = order.services.filter((service) => ["confirmado", "completado", "en_curso"].includes(service.status)).length;
  const openIncidents = order.incidents.filter((incident) => ["abierta", "en_proceso"].includes(incident.status));
  const liveVouchers = order.vouchers.filter((voucher) => voucher.status !== "anulado").length;
  const vouchered = new Set(order.vouchers.filter((voucher) => voucher.status !== "anulado").map((voucher) => voucher.service_code));
  const withoutVoucher = order.services.filter((service) => ["confirmado", "completado"].includes(service.status) && service.kind !== "libre" && !vouchered.has(service.code)).length;
  const due = order.assignments.filter((item) => item.status !== "pendiente" && item.date <= order.today);
  const checkedIn = due.filter((item) => (item.checked_in?.length ?? 0) > 0).length;
  const base = `/operaciones/ordenes/${encodeURIComponent(order.code)}`;
  const alternatives = closed ? null : await getResource<SupplierAlternativeList>(`/ops/supplier-responses?filter[type]=alternativa&filter[review_status]=pendiente&filter[reservation]=${encodeURIComponent(order.reservation.code)}`, "No pudimos cargar las alternativas de proveedores.");

  const { active, groups } = resolveSections(
    base,
    [
      { group: "Operación", id: "servicios", label: "Servicios", icon: <Route size={15} />, count: order.services.length },
      { group: "Operación", id: "tareas", label: "Tareas", icon: <ListChecks size={15} />, count: order.tasks.filter((task) => !task.done).length || undefined },
      { group: "Operación", id: "pasajeros", label: "Pasajeros", icon: <Users size={15} />, count: order.passengers.length },
      { group: "Proveedores", id: "rooming", label: "Rooming", icon: <BedDouble size={15} />, count: order.rooming.length || undefined },
      { group: "Proveedores", id: "vouchers", label: "Vouchers", icon: <TicketCheck size={15} />, count: liveVouchers || undefined },
      { group: "Seguimiento", id: "incidencias", label: "Incidencias", icon: <Siren size={15} />, count: openIncidents.length || undefined },
      { group: "Seguimiento", id: "evidencias", label: "Evidencias", icon: <Camera size={15} />, count: order.evidence_files.length || undefined },
      { group: "Cierre", id: "cierre", label: "Cierre", icon: <ClipboardCheck size={15} /> },
    ],
    seccion,
  );

  const body = await (async () => {
    switch (active) {
      case "tareas":
        return <TasksSection order={order} editable={editable} />;
      case "pasajeros":
        return <PassengersSection order={order} />;
      case "rooming":
        return <RoomingSection order={order} />;
      case "vouchers":
        return <VouchersSection order={order} overview={order.can.vouchers && !closed ? await getResource<VoucherOverview>("/ops/vouchers", "No pudimos cargar los vouchers.") : null} />;
      case "incidencias":
        return <IncidentsSection order={order} list={order.can.incidents ? await getResource<IncidentList>("/ops/incidents", "No pudimos cargar las incidencias.") : null} />;
      case "evidencias":
        return <EvidenceTab order={order} editable={editable} />;
      case "cierre":
        return <CloseSection order={order} closed={closed} />;
      default:
        return <ServicesSection order={order} editable={editable} />;
    }
  })();

  return (
    <ToneScope tone={statusTone(order.status)}>
      <PageHeader
        back={{ href: "/operaciones/ordenes", label: "Órdenes operativas" }}
        jump={false}
        leading={
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--tint)] text-white shadow-[0_10px_24px_-12px_var(--tint)]">
            <ClipboardList size={24} />
          </span>
        }
        title={order.title}
        info={
          <span className="ml-2 flex-none">
            <StatusBadge status={order.status} />
          </span>
        }
        subtitle={order.code}
        actions={
          editable ? (
            <div className="flex flex-wrap items-center justify-end gap-2">
              <OrderEditAction code={order.code} title={order.title} coordinator={order.coordinator.id} coordinators={order.coordinators} />
              {order.status !== "en_ejecucion" && <OrderCancelAction code={order.code} title={order.title} />}
              <OrderAdvanceActions order={order} checks={order.checks} />
            </div>
          ) : undefined
        }
      />

      {order.status === "cancelada" && (
        <p className="mb-5 rounded-card border border-line bg-surface-2 px-4 py-3 text-[13.5px] text-fg-2">
          <b className="text-fg">Cancelada{order.cancelled_at ? ` el ${formatDate(order.cancelled_at)}` : ""}.</b> {order.cancel_reason}
        </p>
      )}

      {alternatives && <SupplierAlternativesNotice data={alternatives} scope="order" />}

      {openIncidents.some((incident) => incident.severity === "critica") && (
        <Notice tone="bad" icon={<Siren size={16} />} action={<Link href={`/operaciones/incidencias/${openIncidents.find((incident) => incident.severity === "critica")?.code}`} className="text-[13px] font-semibold text-[var(--tint)] hover:underline">Ver incidencia</Link>}>
          <b className="font-semibold">Incidencia crítica abierta:</b> {openIncidents.find((incident) => incident.severity === "critica")?.title}
        </Notice>
      )}

      <HeroBand>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div>
            <p className="text-[13px] font-medium text-white/70">Reserva</p>
            <Link href={`/reservas/${order.reservation.code}`} className="mt-1 block text-[26px] font-bold leading-tight tracking-[-0.02em] hover:underline">
              {order.reservation.code}
            </Link>
            <p className="mt-1 text-[13.5px] text-white/80">{order.reservation.client}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <HeroChip icon={<CalendarDays size={14} />}>
                {formatDate(order.date_from).replace(/ \d{4}$/, "")} al {formatDate(order.date_to)}
              </HeroChip>
              <HeroChip icon={<Users size={14} />}>{order.passengers.length === 1 ? "1 pasajero" : `${order.passengers.length} pasajeros`}</HeroChip>
              <HeroChip icon={<UserRound size={14} />}>{shortName(order.coordinator.name)}</HeroChip>
            </div>
          </div>
          <HeroPanel solid>
            <p className="mb-3 text-[13.5px] font-semibold">Avance de la operación</p>
            {order.status === "cancelada" ? <p className="text-[13px] text-fg-3">La orden se canceló y sus recursos quedaron libres.</p> : <Journey steps={steps} formatAt={(iso) => formatDate(iso)} />}
          </HeroPanel>
        </div>
      </HeroBand>

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Truck} tone="t1" label="Con recursos" value={`${assigned} de ${order.assignments.length}`} note="Tours y traslados" info="Asignaciones de la orden que ya tienen guía, conductor o vehículo." />
        <TintTile icon={ShieldCheck} tone="ok" label="Confirmados por proveedor" value={`${confirmedSuppliers} de ${order.services.length}`} info="Servicios de la reserva que el proveedor confirmó con su código, están en curso o completados." />
        <TintTile icon={TicketCheck} tone={withoutVoucher ? "warn" : "violet"} label="Confirmados sin voucher" value={withoutVoucher} note={withoutVoucher ? "Emítelos en Vouchers" : "Todos emitidos"} info="Servicios confirmados por el proveedor que todavía no tienen un voucher vigente para el pasajero." />
        <TintTile icon={ClipboardCheck} tone="t4" label="Con check-in" value={`${checkedIn} de ${due.length}`} note="Servicios hasta hoy" info="Servicios ya iniciados o de fecha pasada con al menos un pasajero marcado como presente, desde la app o la web." />
      </section>

      <SectionLayout nav={<SectionNav label="Secciones de la orden" groups={groups} active={active} testId="order-sections" />}>{body}</SectionLayout>
    </ToneScope>
  );
}
