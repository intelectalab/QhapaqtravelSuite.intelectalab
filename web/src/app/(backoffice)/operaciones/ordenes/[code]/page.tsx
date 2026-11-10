import { CalendarDays, ClipboardCheck, ClipboardList, Camera, ListChecks, Route, ShieldCheck, Siren, Truck, UserRound, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { HeroBand, HeroChip, HeroPanel, Journey, SOFT_TINT, TintCardTitle, TintTile, ToneScope } from "@/components/ui/Tinted";
import { EvidenceSection, ServiceCompleteAction } from "@/features/operations/Evidence";
import { AssignmentControls, CloseChecklist, OrderAdvanceActions, TaskList } from "@/features/operations/OrderActions";
import { Notice, TimeSlot } from "@/features/operations/OpsBits";
import { OrderCancelAction, OrderEditAction } from "@/features/operations/Orders";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatMoney, shortName } from "@/lib/format";
import { ORDER_FLOW, SEVERITY_LABEL, type OrderDetail } from "@/lib/operations";
import { SERVICE_KIND } from "@/lib/reservations";
import { getResource } from "@/lib/server/resource";
import { statusLabel, statusTone } from "@/lib/tone";

const getOrder = cache(async (code: string) => (await getResource<OrderDetail>(`/ops/orders/${encodeURIComponent(code)}`, "No pudimos cargar la orden.")) ?? notFound());

export async function generateMetadata({ params }: PageProps<"/operaciones/ordenes/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: (await getOrder(code)).title };
}

export default async function OrdenPage({ params }: PageProps<"/operaciones/ordenes/[code]">) {
  const { code } = await params;
  const order = await getOrder(code);
  const closed = ["completada", "cancelada"].includes(order.status);
  const editable = order.can.assign && !closed;
  const stepIndex = ORDER_FLOW.indexOf(order.status);
  const steps = ORDER_FLOW.map((status, index) => ({ label: statusLabel(status), at: index === ORDER_FLOW.length - 1 ? order.closed_at : null, done: order.status !== "cancelada" && index <= stepIndex }));
  const assigned = order.assignments.filter((item) => item.status !== "pendiente").length;
  const confirmedSuppliers = order.services.filter((service) => ["confirmado", "completado", "en_curso"].includes(service.status)).length;
  const openIncidents = order.incidents.filter((incident) => ["abierta", "en_proceso"].includes(incident.status));
  const totalCost = order.services.filter((service) => service.status !== "cancelado").reduce<Record<string, number>>((sum, service) => ({ ...sum, [service.currency]: (sum[service.currency] ?? 0) + Number(service.cost) }), {});

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
        <TintTile icon={Truck} tone="t1" label="Con recursos" value={`${assigned} de ${order.assignments.length}`} note="Tours y traslados" />
        <TintTile icon={ShieldCheck} tone="ok" label="Confirmados por proveedor" value={`${confirmedSuppliers} de ${order.services.length}`} />
        <TintTile icon={Siren} tone="bad" label="Incidencias abiertas" value={openIncidents.length} note={`${order.incidents.length} en total`} />
        <TintTile icon={Camera} tone="violet" label="Evidencias" value={order.evidence_files.length} />
      </section>

      {order.reservation.notes && (
        <p className={cn("mb-5 rounded-card px-4 py-3 text-[13.5px]", SOFT_TINT)}>
          <b className="font-semibold">Notas de la reserva.</b> {order.reservation.notes}
        </p>
      )}

      <div className="mb-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card>
          <TintCardTitle icon={Route} title="Servicios y asignaciones" aside={`${order.assignments.length} con recursos`} />
          {order.assignments.length === 0 ? (
            <p className="text-[13.5px] text-fg-3">Esta orden no tiene tours ni traslados que necesiten guía, conductor o vehículo.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {order.assignments.map((assignment, index) => {
                const kind = SERVICE_KIND[assignment.kind] ?? SERVICE_KIND.tour;
                const Icon = kind.icon;
                const people = [assignment.guide?.name && `Guía ${shortName(assignment.guide.name)}`, assignment.driver?.name && `Conductor ${shortName(assignment.driver.name)}`, assignment.vehicle?.name].filter(Boolean);
                return (
                  <li key={assignment.id} style={{ animationDelay: `${index * 50}ms` }} className={cn("lift flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] items-center gap-3 rounded-[14px] px-3 py-3", SOFT_TINT)}>
                    <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-surface text-[var(--tint)]">
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[13.5px] font-semibold">{assignment.label}</b>
                      <span className="text-xs text-fg-3">
                        {formatDate(assignment.date)} · <TimeSlot time={assignment.time} className="min-w-0 text-xs" />
                      </span>
                      <span className={cn("block truncate text-[12.5px]", people.length ? "text-fg-2" : "text-warn")}>{people.length ? people.join(" · ") : "Sin recursos asignados"}</span>
                    </span>
                    <StatusBadge status={assignment.status} />
                    {editable && order.options && !["completada", "en_curso"].includes(assignment.status) && <AssignmentControls assignment={assignment} options={order.options} />}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <TintCardTitle icon={ListChecks} title="Tareas" aside={`${order.tasks.filter((task) => task.done).length} de ${order.tasks.length}`} />
            <TaskList code={order.code} tasks={order.tasks} editable={editable} />
          </Card>

          <Card>
            <TintCardTitle icon={ClipboardCheck} title="Cierre operativo" aside={`${order.checks.filter((check) => check.ok).length} de ${order.checks.length}`} />
            <CloseChecklist checks={order.checks} detailed={!closed} />
            {order.closed_at && <p className="mt-3 text-[12.5px] text-fg-3">Cerrada el {formatDateTime(order.closed_at)}</p>}
          </Card>

          {order.incidents.length > 0 && (
            <ToneScope tone="bad">
              <Card>
                <TintCardTitle icon={Siren} title="Incidencias" aside={String(order.incidents.length)} />
                <ul className="flex flex-col gap-2">
                  {order.incidents.map((incident) => (
                    <li key={incident.code}>
                      <Link href={`/operaciones/incidencias/${incident.code}`} className={cn("lift block rounded-[12px] px-3 py-2.5 text-[13px]", SOFT_TINT)}>
                        <span className="flex items-center justify-between gap-2">
                          <b className="truncate font-semibold">{incident.title}</b>
                          <StatusBadge status={incident.status} />
                        </span>
                        <span className="text-xs text-fg-3">
                          {incident.code} · {incident.type} · {SEVERITY_LABEL[incident.severity] ?? incident.severity}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </ToneScope>
          )}
        </div>
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Card>
          <TintCardTitle icon={ShieldCheck} title="Proveedores y costos" aside={Object.entries(totalCost).map(([currency, amount]) => formatMoney(amount, currency)).join(" · ")} />
          <ul className="flex flex-col">
            {order.services.map((service) => (
              <li key={service.code} className={cn("flex items-center gap-3 border-t border-line-2 py-2.5 text-[13px] first:border-t-0", service.status === "cancelado" && "opacity-50")}>
                <TimeSlot time={service.time} />
                <span className="min-w-0 flex-1">
                  <b className="block truncate font-semibold">{service.name}</b>
                  <span className="text-xs text-fg-3">
                    {formatDate(service.date)}
                    {service.confirmation ? ` · ${service.confirmation}` : ""}
                  </span>
                </span>
                <span className="font-mono text-[12.5px]">{formatMoney(service.cost, service.currency)}</span>
                <StatusBadge status={service.status} />
                {editable && <ServiceCompleteAction service={service} today={order.today} orderCode={order.code} />}
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <TintCardTitle icon={Users} title="Pasajeros" aside={String(order.passengers.length)} />
          <ul className="flex flex-col">
            {order.passengers.map((passenger) => (
              <li key={passenger.id} className="flex items-center gap-3 border-t border-line-2 py-2.5 first:border-t-0">
                <span className="min-w-0 flex-1">
                  <b className="block truncate text-[13.5px] font-semibold">
                    {passenger.full_name}
                    {passenger.is_lead && <span className="ml-1.5 text-[11.5px] font-medium text-[var(--tint)]">Titular</span>}
                  </b>
                  <span className="text-xs text-fg-3">{[passenger.nationality, passenger.diet_notes].filter(Boolean).join(" · ") || "Sin indicaciones"}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>

        <ToneScope tone="violet" className="xl:col-span-2">
          <Card>
            <TintCardTitle icon={Camera} title="Evidencias" aside={String(order.evidence_files.length)} />
            <EvidenceSection
              scope="order"
              target={order.code}
              files={order.evidence_files}
              canUpload={editable}
              canRemove={editable}
              services={order.services}
              rules={order.evidence_rules}
              emptyText={editable ? "Aún no hay evidencias. Sube al menos una foto o acta de la operación para poder cerrarla." : "La orden no tiene evidencias registradas."}
            />
          </Card>
        </ToneScope>
      </div>
    </ToneScope>
  );
}
