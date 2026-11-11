import { BedDouble, Camera, ClipboardCheck, Coins, ListChecks, Plane, Route, ShieldCheck, Siren, TicketCheck, Truck, Users } from "lucide-react";
import Link from "next/link";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { DownloadButton } from "@/components/ui/DownloadButton";
import { MiniTable } from "@/components/ui/MiniTable";
import { SOFT_TINT, TintCardTitle, ToneScope } from "@/components/ui/Tinted";
import { ServiceRowActions } from "@/features/reservations/ReservationLifecycleActions";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatMoney, shortName } from "@/lib/format";
import { SEVERITY_LABEL, type EvidenceFile, type IncidentList, type OrderDetail, type VoucherOverview } from "@/lib/operations";
import { PAX_TYPE, SERVICE_KIND } from "@/lib/reservations";
import { EvidenceSection, ServiceCompleteAction } from "./Evidence";
import { OrderIncidentCreateAction } from "./Incidents";
import { TimeSlot } from "./OpsBits";
import { AssignmentControls, CloseChecklist, TaskList } from "./OrderActions";
import { RoomingPrefillAction } from "./Rooming";
import { PendingVouchers } from "./Vouchers";

export function ClientOperationData({ order }: { order: OrderDetail }) {
  const web = order.web;
  const diets = order.passengers.filter((passenger) => passenger.diet_notes);
  if (!web && diets.length === 0 && !order.reservation.notes) return null;
  return (
    <Card>
      <TintCardTitle icon={Plane} title="Datos del cliente para la operación" />
      <div className="grid gap-4 md:grid-cols-2">
        <FieldList
          fields={[
            ...(web ? [{ label: "Recojo", value: <span className="whitespace-normal">{[web.pickup.point, web.pickup.address].filter(Boolean).join(" · ") || "Sin indicar"}</span> }] : []),
            ...(web?.pickup.flight ? [{ label: "Vuelo", value: `${web.pickup.flight}${web.pickup.arrival ? ` · llega ${formatDateTime(web.pickup.arrival)}` : ""}` }] : []),
            ...(web?.comments ? [{ label: "Pedido del cliente", value: <span className="whitespace-normal">{web.comments}</span> }] : []),
            ...(order.reservation.notes ? [{ label: "Notas de la reserva", value: <span className="whitespace-normal">{order.reservation.notes}</span> }] : []),
          ]}
        />
        {diets.length > 0 && (
          <div>
            <p className="mb-1.5 text-[12.5px] font-semibold text-fg-3">Dietas y alergias</p>
            <ul className="flex flex-col gap-1.5">
              {diets.map((passenger) => (
                <li key={passenger.id} className={cn("rounded-[10px] px-3 py-2 text-[13px]", SOFT_TINT)}>
                  <b className="font-semibold">{passenger.full_name}</b>
                  <span className="block text-fg-2">{passenger.diet_notes}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

export function ServicesSection({ order, editable }: { order: OrderDetail; editable: boolean }) {
  const showPrice = order.economics !== null;
  return (
    <div className="flex flex-col gap-5">
      <ClientOperationData order={order} />
      <Card>
        <TintCardTitle icon={Truck} title="Asignaciones" aside={`${order.assignments.filter((item) => item.status !== "pendiente").length} de ${order.assignments.length} con recursos`} />
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
                    {(assignment.checked_in?.length ?? 0) > 0 && (
                      <span className="block text-[12px] font-medium text-ok">
                        Check-in {assignment.checked_in?.length} de {order.passengers.length}
                        {assignment.checkin_at ? ` · desde ${formatDateTime(assignment.checkin_at, false)}` : ""}
                      </span>
                    )}
                  </span>
                  <StatusBadge status={assignment.status} />
                  {editable && order.options && !["completada", "en_curso"].includes(assignment.status) && <AssignmentControls assignment={assignment} options={order.options} passengers={order.passengers} today={order.today} />}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Card>
        <TintCardTitle icon={ShieldCheck} title="Servicios y proveedores" aside={`${order.services.filter((service) => ["confirmado", "completado", "en_curso"].includes(service.status)).length} de ${order.services.length} confirmados`} />
        <ul className="flex flex-col">
          {order.services.map((service) => (
            <li key={service.code} className={cn("flex items-center gap-3 border-t border-line-2 py-2.5 text-[13px] first:border-t-0", (service.status === "cancelado" || service.replaced) && "opacity-50")}>
              <TimeSlot time={service.time} />
              <span className="min-w-0 flex-1">
                <b className="block truncate font-semibold">
                  {service.product ? (
                    <Link href={`/catalogo/productos/${service.product}`} className="hover:underline">
                      {service.name}
                    </Link>
                  ) : (
                    service.name
                  )}
                </b>
                <span className="text-xs text-fg-3">
                  {formatDate(service.date)}
                  {service.provider ? ` · ${service.provider.name}` : " · Sin proveedor"}
                  {service.confirmation ? ` · ${service.confirmation}` : ""}
                </span>
                {service.status === "rechazado" && service.reject_reason && <span className="block text-xs text-bad">{service.reject_reason}</span>}
              </span>
              <span className="flex-none text-right font-mono text-[12.5px]">
                {showPrice && service.price !== undefined && <b className="block font-semibold">{formatMoney(service.price, service.currency)}</b>}
                <span className="text-fg-3">
                  {showPrice ? "costo " : ""}
                  {formatMoney(service.cost, service.currency)}
                </span>
              </span>
              <StatusBadge status={service.status} />
              {order.can.services && !["completada", "cancelada"].includes(order.status) && (
                <ServiceRowActions code={order.reservation.code} service={{ code: service.code, name: service.name, date: service.date, time: service.time, kind: service.kind, status: service.status, confirmation: service.confirmation, reject_reason: service.reject_reason, replaced: service.replaced, provider: service.provider ? { name: service.provider.name, active: service.provider.active } : null, cost: service.cost, currency: service.currency }} reasons={order.reject_reasons} />
              )}
              {editable && <ServiceCompleteAction service={service} today={order.today} orderCode={order.code} />}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

export function TasksSection({ order, editable }: { order: OrderDetail; editable: boolean }) {
  return (
    <Card>
      <TintCardTitle icon={ListChecks} title="Tareas" aside={`${order.tasks.filter((task) => task.done).length} de ${order.tasks.length}`} />
      <TaskList code={order.code} tasks={order.tasks} editable={editable} />
    </Card>
  );
}

export function PassengersSection({ order }: { order: OrderDetail }) {
  const checkable = order.assignments.filter((assignment) => assignment.status !== "pendiente" && assignment.date <= order.today).length;
  return (
    <Card>
      <TintCardTitle icon={Users} title="Pasajeros" aside={String(order.passengers.length)} />
      <MiniTable head={["Pasajero", "Tipo", "Edad", "Documento", "Nacionalidad", "Teléfono", "Dieta y notas", "Check-ins"]} align={["left", "left", "left", "left", "left", "left", "left", "right"]} minWidth={780}>
        {order.passengers.map((passenger) => (
          <tr key={passenger.id}>
            <td>
              <b className="block font-semibold">
                {passenger.full_name}
                {passenger.is_lead && <span className="ml-1.5 text-[11.5px] font-medium text-[var(--tint)]">Titular</span>}
              </b>
              {passenger.relationship && !(passenger.is_lead && passenger.relationship === "Titular") && <span className="text-xs text-fg-3">{passenger.relationship}</span>}
            </td>
            <td>{PAX_TYPE[passenger.pax_type] ?? passenger.pax_type}</td>
            <td className="tabular-nums">{passenger.age ?? "—"}</td>
            <td>{passenger.doc_number ? `${passenger.doc_type ?? ""} ${passenger.doc_number}`.trim() : <span className="text-warn">Por completar</span>}</td>
            <td>{passenger.nationality ?? "—"}</td>
            <td>{passenger.phone ?? "—"}</td>
            <td className="text-xs">{passenger.diet_notes ?? "—"}</td>
            <td className="text-right" title={passenger.last_checkin_at ? `Último: ${formatDateTime(passenger.last_checkin_at)}` : undefined}>
              <span className={cn("tabular-nums font-semibold", passenger.checkins ? "text-ok" : "text-fg-3")}>
                {passenger.checkins} de {checkable}
              </span>
            </td>
          </tr>
        ))}
      </MiniTable>
    </Card>
  );
}

export function RoomingSection({ order }: { order: OrderDetail }) {
  const canPrefill = order.can.rooming && order.lodging_pending.length > 0 && !["completada", "cancelada"].includes(order.status);
  return (
    <Card>
      <TintCardTitle icon={BedDouble} title="Rooming" aside={<Link href="/operaciones/rooming" className="text-[12.5px] font-semibold text-[var(--tint)] hover:underline">Gestionar rooming</Link>} />
      {order.lodging_pending.length > 0 && (
        <div className={cn("mb-4 flex flex-wrap items-center gap-3 rounded-tile px-3.5 py-3", SOFT_TINT)}>
          <span className="min-w-0 flex-1 text-[13px]">
            <b className="block font-semibold">La reserva web trae alojamiento sin rooming list</b>
            <span className="text-fg-2">{order.lodging_pending.map((leg) => `${leg.city}: ${leg.rooms} hab. en ${leg.hotel} (${formatDate(leg.check_in).replace(/ \d{4}$/, "")} al ${formatDate(leg.check_out)})`).join(" · ")}</span>
          </span>
          {canPrefill && <RoomingPrefillAction reservation={order.reservation.code} legs={order.lodging_pending.length} />}
        </div>
      )}
      {order.rooming.length === 0 ? (
        <p className="text-[13.5px] text-fg-3">La reserva no tiene listas de habitaciones. Créalas en Rooming cuando el viaje incluya hoteles.</p>
      ) : (
        <MiniTable head={["Hotel", "Fechas", "Habitaciones", "Huéspedes", "Enviada", "Estado"]} align={["left", "left", "right", "right", "left", "left"]}>
          {order.rooming.map((list) => (
            <tr key={list.id}>
              <td>
                <b className="block font-semibold">{list.hotel ?? list.hotel_name ?? "Hotel por definir"}</b>
                {list.city && <span className="text-xs text-fg-3">{list.city}</span>}
              </td>
              <td className="whitespace-nowrap">
                {formatDate(list.check_in).replace(/ \d{4}$/, "")} al {formatDate(list.check_out)}
              </td>
              <td className="text-right tabular-nums">{list.rooms}</td>
              <td className="text-right tabular-nums">{list.guests}</td>
              <td className="whitespace-nowrap text-xs">{list.sent_at ? formatDateTime(list.sent_at) : "Sin enviar"}</td>
              <td>
                <StatusBadge status={list.status} />
              </td>
            </tr>
          ))}
        </MiniTable>
      )}
    </Card>
  );
}

export function VouchersSection({ order, overview }: { order: OrderDetail; overview: VoucherOverview | null }) {
  const pending = overview ? { ...overview, pending: overview.pending.filter((service) => service.reservation.code === order.reservation.code) } : null;
  return (
    <div className="flex flex-col">
      {pending && <PendingVouchers data={pending} />}
      <Card>
        <TintCardTitle icon={TicketCheck} title="Vouchers emitidos" aside={order.vouchers.length ? String(order.vouchers.length) : undefined} />
        {order.vouchers.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">Todavía no se emitieron vouchers. Se emiten cuando el proveedor confirma cada servicio.</p>
        ) : (
          <MiniTable head={["Voucher", "Servicio", "Proveedor", "Pax", "Versión", "Estado", ""]} align={["left", "left", "left", "right", "right", "left", "right"]} minWidth={680}>
            {order.vouchers.map((voucher) => (
              <tr key={voucher.code}>
                <td className="font-mono text-xs">{voucher.code}</td>
                <td>
                  <b className="block font-semibold">{voucher.service_label}</b>
                  <span className="text-xs text-fg-3">{formatDate(voucher.service_date)}</span>
                </td>
                <td>{voucher.provider ?? "—"}</td>
                <td className="text-right tabular-nums">{voucher.pax}</td>
                <td className="text-right tabular-nums">{voucher.version}</td>
                <td>
                  <StatusBadge status={voucher.status} />
                </td>
                <td className="text-right">{voucher.status !== "anulado" && <DownloadButton href={`/operaciones/vouchers/${voucher.code}/pdf`} label={`Descargar voucher ${voucher.code}`} size="sm" variant="ghost" iconOnly />}</td>
              </tr>
            ))}
          </MiniTable>
        )}
      </Card>
    </div>
  );
}

export function IncidentsSection({ order, list }: { order: OrderDetail; list: IncidentList | null }) {
  const canCreate = order.can.incidents && list !== null && order.status !== "cancelada";
  return (
    <ToneScope tone="bad">
      <Card>
        <TintCardTitle icon={Siren} title="Incidencias" aside={canCreate ? <OrderIncidentCreateAction orderCode={order.code} types={list.types} assignees={list.assignees} /> : order.incidents.length ? String(order.incidents.length) : undefined} />
        {order.incidents.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">No se reportaron incidencias en esta operación.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {order.incidents.map((incident) => (
              <li key={incident.code}>
                <Link href={`/operaciones/incidencias/${incident.code}`} className={cn("lift block rounded-[12px] px-3 py-2.5 text-[13px]", SOFT_TINT)}>
                  <span className="flex items-center justify-between gap-2">
                    <b className="truncate font-semibold">{incident.title}</b>
                    <StatusBadge status={incident.status} />
                  </span>
                  <span className="text-xs text-fg-3">
                    {incident.code} · {incident.type} · {SEVERITY_LABEL[incident.severity] ?? incident.severity} · {formatDateTime(incident.created_at)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </ToneScope>
  );
}

export function EvidenceTab({ order, editable }: { order: OrderDetail; editable: boolean }) {
  const own = order.evidence_files.filter((file) => !file.incident);
  const byIncident = Object.entries(
    order.evidence_files
      .filter((file) => file.incident)
      .reduce<Record<string, { title: string; files: EvidenceFile[] }>>((acc, file) => {
        const key = file.incident ?? "";
        acc[key] = { title: file.incident_title ?? key, files: [...(acc[key]?.files ?? []), file] };
        return acc;
      }, {}),
  );
  return (
    <ToneScope tone="violet">
      <Card>
        <TintCardTitle icon={Camera} title="Evidencias de la operación" aside={String(own.length)} />
        <EvidenceSection
          scope="order"
          target={order.code}
          files={own}
          canUpload={editable}
          canRemove={editable}
          services={order.services}
          rules={order.evidence_rules}
          emptyText={editable ? "Aún no hay evidencias. Sube al menos una foto o acta de la operación para poder cerrarla." : "La orden no tiene evidencias registradas."}
        />
      </Card>
      {byIncident.length > 0 && (
        <Card className="mt-5">
          <TintCardTitle icon={Siren} title="Evidencias de sus incidencias" aside={String(byIncident.reduce((sum, [, group]) => sum + group.files.length, 0))} />
          <div className="flex flex-col gap-4">
            {byIncident.map(([code, group]) => (
              <div key={code}>
                <Link href={`/operaciones/incidencias/${code}`} className="mb-2 flex items-center gap-2 text-[13px] font-semibold hover:underline">
                  <span className="font-mono text-xs text-fg-3">{code}</span>
                  {group.title}
                </Link>
                <EvidenceSection scope="incident" target={code} files={group.files} canUpload={false} canRemove={false} emptyText="" />
              </div>
            ))}
          </div>
        </Card>
      )}
    </ToneScope>
  );
}

export function CloseSection({ order, closed }: { order: OrderDetail; closed: boolean }) {
  const active = order.services.filter((service) => service.status !== "cancelado");
  const byProvider = Object.entries(
    active.reduce<Record<string, Record<string, number>>>((acc, service) => {
      const name = service.provider?.name ?? "Sin proveedor";
      acc[name] = { ...(acc[name] ?? {}), [service.currency]: (acc[name]?.[service.currency] ?? 0) + Number(service.cost) };
      return acc;
    }, {}),
  );
  const economics = order.economics;
  const pendingTasks = order.tasks.filter((task) => !task.done);
  return (
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <Card>
        <TintCardTitle icon={ClipboardCheck} title="Cierre operativo" aside={`${order.checks.filter((check) => check.ok).length} de ${order.checks.length}`} />
        <CloseChecklist checks={order.checks} detailed={!closed} />
        {pendingTasks.length > 0 && !closed && <p className="mt-3 text-[12.5px] text-fg-3">{pendingTasks.length === 1 ? "Queda 1 tarea abierta" : `Quedan ${pendingTasks.length} tareas abiertas`}; no bloquean el cierre.</p>}
        {order.closed_at && <p className="mt-3 text-[12.5px] text-fg-3">Cerrada el {formatDateTime(order.closed_at)}</p>}
      </Card>
      {economics ? (
        <Card>
          <TintCardTitle icon={Coins} title="Resumen económico" />
          <FieldList
            fields={[
              { label: "Venta sin IGV", value: <span className="font-mono">{formatMoney(economics.sale, economics.currency)}</span> },
              { label: "Costo de proveedores", value: <span className="font-mono">{formatMoney(economics.cost, economics.currency)}</span> },
              {
                label: "Margen",
                value: (
                  <b className="font-mono">
                    {formatMoney(Number(economics.sale) - Number(economics.cost), economics.currency)}
                    {Number(economics.sale) > 0 && ` · ${(((Number(economics.sale) - Number(economics.cost)) / Number(economics.sale)) * 100).toFixed(1)} %`}
                  </b>
                ),
              },
            ]}
          />
        </Card>
      ) : (
        <Card>
          <TintCardTitle icon={Route} title="Costos por proveedor" />
          <ul className="flex flex-col">
            {byProvider.map(([name, totals]) => (
              <li key={name} className="flex items-center justify-between gap-3 border-t border-line-2 py-2 text-[13px] first:border-t-0">
                <span className="truncate">{name}</span>
                <span className="font-mono">
                  {Object.entries(totals)
                    .map(([currency, amount]) => formatMoney(amount, currency))
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
