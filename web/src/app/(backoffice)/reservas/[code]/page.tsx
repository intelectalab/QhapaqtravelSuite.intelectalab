import { CalendarDays, ClipboardList, FileText, History, MapPin, Receipt, Route, TicketCheck, TriangleAlert, UserRound, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { LiveTag, StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { DownloadButton } from "@/components/ui/DownloadButton";
import { HeroBand, HeroChip, HeroPanel, SOFT_TINT, TintCardTitle, TintTile, ToneScope } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { amountAttr, formatDate, formatDateTime, formatMoney, shortName } from "@/lib/format";
import { PendingChanges, ReservationModifyAction, ReservationRescheduleAction } from "@/features/reservations/ReservationChangeActions";
import { PassengerAddAction, PassengerRowActions, ReservationCancelAction, ReservationEditAction, ReservationRejectRequestAction, ReservationRequestCancelAction } from "@/features/reservations/ReservationActions";
import { RequestPendingServicesAction, ReservationOrderAction, ReservationReassignAction, ReservationReceivablesAction, ReservationStateActions, ServiceRowActions } from "@/features/reservations/ReservationLifecycleActions";
import { ReservationLockScope } from "@/features/reservations/ReservationLock";
import { CLOSED_RESERVATION, PAX_TYPE, SERVICE_KIND } from "@/lib/reservations";
import { getAdvisors } from "@/lib/server/leads";
import { getChangeOptions, getReservation, getReservationCancellation } from "@/lib/server/reservations";
import { statusTone } from "@/lib/tone";

export async function generateMetadata({ params }: PageProps<"/reservas/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: (await getReservation(code)).title };
}

const dayLabel = (iso: string) => formatDate(iso, "long");

const ACTION_LABEL: Record<string, string> = {
  crear_desde_cotizacion: "Creada desde la cotización",
  crear_ecommerce: "Creada desde el sitio web",
  confirmar: "Confirmada",
  verificar_disponibilidad: "Disponibilidad verificada",
  iniciar_operacion: "Inició la operación",
  completar: "Viaje completado",
  reasignar: "Reasignada",
  editar: "Notas actualizadas",
  agregar_pasajero: "Pasajero agregado",
  editar_pasajero: "Pasajero actualizado",
  quitar_pasajero: "Pasajero quitado",
  solicitar_modificacion: "Modificación solicitada",
  modificar: "Modificada",
  rechazar_modificacion: "Modificación rechazada",
  reprogramar: "Reprogramada",
  solicitar_anulacion: "Anulación solicitada",
  rechazar_anulacion: "Anulación rechazada",
  retirar_anulacion: "Anulación retirada",
  cancelar: "Cancelada",
  cambio_estado: "Cambio de estado",
};

const HIDDEN_VALUE = new Set(["editar", "reasignar", "agregar_pasajero", "editar_pasajero"]);

export default async function ReservaPage({ params, searchParams }: PageProps<"/reservas/[code]">) {
  const { code } = await params;
  const { editar, cancelar } = await searchParams;
  const reservation = await getReservation(code);
  const closed = CLOSED_RESERVATION.includes(reservation.status);
  const canCancel = !closed && (reservation.can.cancel || reservation.can.request_cancel);
  const [preview, advisors, changeOptions] = await Promise.all([canCancel ? getReservationCancellation(code) : null, reservation.can.reassign ? getAdvisors() : [], !closed && reservation.can.modify ? getChangeOptions(code) : null]);
  const editable = !closed && reservation.can.modify;
  const printable = !["borrador", "cancelada"].includes(reservation.status);
  const receivables = reservation.receivables;
  const operationsView = reservation.view?.mode === "operations";
  const charged = (receivables ?? []).filter((item) => item.status !== "cancelada");
  const totalCharged = charged.reduce((sum, item) => sum + Number(item.amount), 0);
  const totalPaid = charged.reduce((sum, item) => sum + Number(item.paid_amount), 0);
  const paidPct = totalCharged > 0 ? Math.round((totalPaid / totalCharged) * 100) : 0;
  const overdue = charged.some((item) => item.status === "vencida");
  const traveling = reservation.travel_from <= reservation.today && reservation.travel_to >= reservation.today && reservation.status !== "cancelada";
  const days = [...new Set(reservation.services.map((service) => service.date))];
  const pendingServices = reservation.services.filter((service) => service.status === "pendiente" && service.provider?.active).length;

  return (
    <ToneScope tone={statusTone(reservation.status)}>
      <ReservationLockScope version={reservation.lock_version}>
      <PageHeader
        back={{ href: "/reservas", label: "Reservas" }}
        jump={false}
        leading={
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--tint)] text-white shadow-[0_10px_24px_-12px_var(--tint)]">
            <Route size={24} />
          </span>
        }
        title={reservation.title}
        info={
          <span className="ml-2 flex flex-none items-center gap-2">
            <StatusBadge status={reservation.status} primary />
            {traveling && <LiveTag>De viaje</LiveTag>}
          </span>
        }
        subtitle={<span data-testid="reservation-code">{reservation.code}</span>}
        actions={
          closed && !printable ? undefined : (
            <div className="flex flex-wrap items-center justify-end gap-2">
              {printable && <DownloadButton href={`/reservas/${reservation.code}/confirmacion`} label="Confirmación PDF" iconOnlyOnMobile />}
              {!closed && (
                <>
                  <ReservationStateActions reservation={reservation} />
                  {reservation.can.modify && <ReservationEditAction reservation={reservation} defaultOpen={editar === "1"} />}
                  {reservation.can.reassign && advisors.length > 0 && <ReservationReassignAction reservation={reservation} advisors={advisors} />}
                  {reservation.can.operation_order && <ReservationOrderAction code={reservation.code} />}
                  {changeOptions && <ReservationModifyAction code={reservation.code} currency={reservation.currency} options={changeOptions} />}
                  {changeOptions && <ReservationRescheduleAction code={reservation.code} />}
                  {preview && reservation.can.cancel && <ReservationCancelAction reservation={reservation} preview={preview} defaultOpen={cancelar === "1"} />}
                  {preview && reservation.can.request_cancel && !reservation.cancel_request && <ReservationRequestCancelAction reservation={reservation} preview={preview} defaultOpen={cancelar === "1"} />}
                </>
              )}
            </div>
          )
        }
      />

      <HeroBand>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
          <div>
            {reservation.total !== undefined ? (
              <>
                <p className="text-[13px] font-medium text-white/70">Total del viaje</p>
                <p data-testid="reservation-total" data-amount={amountAttr(reservation.total)} className="mt-1 text-[38px] font-bold leading-none tracking-[-0.03em]">{formatMoney(reservation.total, reservation.currency)}</p>
                {reservation.currency !== "PEN" && reservation.total_pen !== undefined && <p className="mt-2 text-[13.5px] text-white/75">{formatMoney(reservation.total_pen)} al cambio de la reserva</p>}
              </>
            ) : (
              <>
                <p className="text-[13px] font-medium text-white/70">Vista de Operaciones</p>
                <p className="mt-1 max-w-sm text-[15px] leading-snug text-white/85">Servicios, pasajeros y costo de proveedores. Los importes de venta y los cobros los lleva Finanzas.</p>
              </>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <HeroChip icon={<CalendarDays size={14} />}>
                {formatDate(reservation.travel_from).replace(/ \d{4}$/, "")} al {formatDate(reservation.travel_to)}
              </HeroChip>
              <HeroChip icon={<Users size={14} />}>{reservation.passengers.length === 1 ? "1 pasajero" : `${reservation.passengers.length} pasajeros`}</HeroChip>
              <HeroChip icon={<MapPin size={14} />}>{reservation.channel}</HeroChip>
            </div>
          </div>
          {receivables && (
            <HeroPanel solid>
              <div className="mb-2.5 flex items-center justify-between">
                <p className="text-[13.5px] font-semibold">Cobros</p>
                <span className={cn("text-[13px] font-semibold", overdue ? "text-bad" : totalPaid >= totalCharged && totalCharged > 0 ? "text-ok" : "text-fg-2")}>
                  {totalCharged === 0 ? "Sin cobros programados" : totalPaid >= totalCharged ? "Pagado" : overdue ? "Tiene cuotas vencidas" : "Al día"}
                </span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                <span className={cn("block h-full rounded-full", overdue ? "bg-bad" : "bg-ok")} style={{ width: `${paidPct}%` }} />
              </div>
              <div className="mt-2.5 grid grid-cols-2 text-[13px]">
                <span>
                  <span className="block text-[12px] text-fg-3">Pagado</span>
                  <b className="font-semibold">{formatMoney(totalPaid, reservation.currency)}</b>
                </span>
                <span className="text-right">
                  <span className="block text-[12px] text-fg-3">Falta cobrar</span>
                  <b className={cn("font-semibold", overdue && "text-bad")}>{formatMoney(Math.max(0, totalCharged - totalPaid), reservation.currency)}</b>
                </span>
              </div>
            </HeroPanel>
          )}
        </div>
      </HeroBand>

      {reservation.status === "cancelada" && reservation.cancel_reason && (
        <p className="mb-5 rounded-card border border-line bg-surface-2 px-4 py-3 text-[13.5px] text-fg-2">
          <b className="text-fg">Cancelada.</b> {reservation.cancel_reason}
          {reservation.cancellation?.penalty_amount !== undefined && ` · Penalidad ${formatMoney(reservation.cancellation.penalty_amount, reservation.currency)}${Number(reservation.cancellation.refund_amount ?? 0) > 0 ? ` · Reembolso ${formatMoney(reservation.cancellation.refund_amount ?? 0, reservation.currency)}` : ""}`}
        </p>
      )}

      {!closed && reservation.cancel_request && (
        <div className="mb-5 flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-wrap items-center gap-3 rounded-card border border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-4 py-3 text-[13.5px]">
          <span className="min-w-0 flex-1">
            <b className="font-semibold">Anulación solicitada</b> el {formatDate(reservation.cancel_request.requested_at)} · {reservation.cancel_request.reason}
          </span>
          {reservation.can.cancel && <ReservationRejectRequestAction code={reservation.code} request={reservation.cancel_request.id} />}
        </div>
      )}

      {!closed && <PendingChanges code={reservation.code} currency={reservation.currency} changes={reservation.changes} canApprove={reservation.can.approve_changes} />}

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={UserRound} tone="t1" label="Cliente" value={<Link href={`/crm/clientes/${reservation.client.code}`} className="text-[16px] hover:underline">{reservation.client.name}</Link>} />
        <TintTile icon={Users} tone="t4" label="Responsable" value={<span className="text-[16px]">{shortName(reservation.owner.name)}</span>} note={reservation.sede ?? undefined} />
        <TintTile icon={FileText} tone="violet" label="Cotización" value={<span className="text-[16px]">{reservation.quote ? <Link href={`/cotizaciones/${reservation.quote.code}`} className="hover:underline">{reservation.quote.code}</Link> : "Venta directa"}</span>} />
        <TintTile icon={Wallet} tone="sun" label="Margen" value={reservation.margin_pct === undefined ? <span className="text-[14px] text-fg-3">No visible para tu rol</span> : reservation.margin_pct === null ? <span className="text-[14px] text-fg-3">Sin servicios activos</span> : `${reservation.margin_pct} %`} />
      </section>

      <div className="mb-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <TintCardTitle
            icon={Route}
            title="Servicios"
            aside={
              <span className="flex items-center gap-2">
                {reservation.order && (
                  <Link href={`/operaciones/ordenes/${reservation.order}`} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--tint)] hover:underline">
                    <ClipboardList size={14} />
                    {reservation.order}
                  </Link>
                )}
                {reservation.can.services && pendingServices > 0 ? <RequestPendingServicesAction code={reservation.code} count={pendingServices} /> : String(reservation.services.length)}
              </span>
            }
          />
          {days.length === 0 ? (
            <p className="text-[13.5px] text-fg-3">Esta reserva no tiene servicios todavía.</p>
          ) : (
            <ol className="flex flex-col gap-4">
              {days.map((day) => (
                <li key={day}>
                  <p className={cn("mb-2 text-[13px] font-semibold first-letter:uppercase", day === reservation.today ? "text-[var(--tint)]" : "text-fg-2")}>
                    {dayLabel(day)}
                    {day === reservation.today && " · hoy"}
                  </p>
                  <ul className="flex flex-col gap-1.5">
                    {reservation.services
                      .filter((service) => service.date === day)
                      .map((service) => {
                        const kind = SERVICE_KIND[service.kind] ?? SERVICE_KIND.tour;
                        const Icon = kind.icon;
                        return (
                          <li key={service.code} data-testid={`reservation-service:${service.code}`} data-status={service.status} data-price={service.price === undefined ? undefined : amountAttr(service.price)} className={cn("flex items-center gap-3 rounded-[12px] px-3 py-2.5", SOFT_TINT, (service.status === "cancelado" || service.replaced) && "opacity-50")}>
                            <span className="grid h-8 w-8 flex-none place-items-center rounded-[9px] bg-surface text-[var(--tint)]">
                              <Icon size={16} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <b className="block truncate text-[13.5px] font-semibold">{service.name}</b>
                              <span className="text-xs text-fg-3">
                                {service.time ? `${service.time} · ` : ""}
                                {service.provider ? service.provider.name : kind.label}
                                {service.confirmation ? ` · ${service.confirmation}` : ""}
                              </span>
                              {service.status === "rechazado" && service.reject_reason && <span className="block text-xs text-bad">{service.reject_reason}</span>}
                            </span>
                            {operationsView && service.cost !== undefined && <span className="flex-none font-mono text-[12.5px] text-fg-2" title="Costo del proveedor">{formatMoney(service.cost, service.currency)}</span>}
                            <StatusBadge status={service.status} />
                            {reservation.can.services && <ServiceRowActions code={reservation.code} service={service} reasons={reservation.reject_reasons} />}
                          </li>
                        );
                      })}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <div className="flex flex-col gap-5">
          <Card>
            <TintCardTitle icon={Users} title="Pasajeros" aside={editable ? <PassengerAddAction code={reservation.code} /> : String(reservation.passengers.length)} />
            <ul className="flex flex-col">
              {reservation.passengers.map((passenger) => (
                <li key={passenger.id} className="flex items-center gap-3 border-t border-line-2 py-2.5 first:border-t-0">
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[13.5px] font-semibold">
                      {passenger.full_name}
                      {passenger.is_lead && <span className="ml-1.5 text-[11.5px] font-medium text-[var(--tint)]">Titular</span>}
                    </b>
                    <span className="text-xs text-fg-3">
                      {[PAX_TYPE[passenger.pax_type] ?? passenger.pax_type, passenger.doc_number ? `${passenger.doc_type ?? ""} ${passenger.doc_number}`.trim() : null, passenger.diet_notes].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {editable && <PassengerRowActions code={reservation.code} passenger={passenger} canRemove={reservation.passengers.length > 1} />}
                </li>
              ))}
            </ul>
          </Card>

          {receivables && (
            <Card>
              <TintCardTitle icon={Receipt} title="Cuotas" aside={reservation.can.generate_receivables ? <ReservationReceivablesAction code={reservation.code} /> : undefined} />
              {charged.length === 0 ? (
                <p className="text-[13.5px] text-fg-3">Sin cuotas programadas.</p>
              ) : (
                <ul className="flex flex-col">
                  {charged.map((item) => (
                    <li key={item.code} data-testid={`reservation-receivable:${item.kind}`} data-amount={amountAttr(item.amount)} data-due={item.due_date.slice(0, 10)} className="flex items-center gap-3 border-t border-line-2 py-2.5 text-[13px] first:border-t-0">
                      <span className="min-w-0 flex-1">
                        <b className="block truncate font-semibold">{item.concept}</b>
                        <span className="text-xs text-fg-3">Vence el {formatDate(item.due_date)}</span>
                      </span>
                      <span className="font-mono text-[13px]">{formatMoney(item.amount, item.currency)}</span>
                      <StatusBadge status={item.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}

          {reservation.vouchers.length > 0 && (
            <Card>
              <TintCardTitle icon={TicketCheck} title="Vouchers" aside={String(reservation.vouchers.length)} />
              <ul className="flex flex-col gap-2">
                {reservation.vouchers.map((voucher) => (
                  <li key={voucher.code} className="flex items-center gap-3 rounded-[12px] border border-line-2 px-3 py-2.5 text-[13px] transition-colors duration-300 hover:bg-surface-2">
                    <span className="min-w-0 flex-1">
                      <b className="block truncate font-semibold">{voucher.label}</b>
                      <span className="text-xs text-fg-3">
                        {voucher.code} · {formatDate(voucher.date)}
                        {voucher.version > 1 && ` · versión ${voucher.version}`}
                      </span>
                    </span>
                    <StatusBadge status={voucher.status} />
                    <DownloadButton href={`/operaciones/vouchers/${voucher.code}/pdf`} label={`Descargar voucher ${voucher.code}`} size="sm" variant="ghost" iconOnly />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {reservation.incidents.length > 0 && (
            <ToneScope tone="bad">
              <Card>
                <TintCardTitle icon={TriangleAlert} title="Incidencias" />
                <ul className="flex flex-col gap-2">
                  {reservation.incidents.map((incident) => (
                    <li key={incident.code} className={cn("rounded-[12px] px-3 py-2.5 text-[13px]", SOFT_TINT)}>
                      <b className="block font-semibold">{incident.title}</b>
                      <span className="text-xs text-fg-3">
                        {incident.code} · {incident.type} · gravedad {incident.severity}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </ToneScope>
          )}

          {reservation.history.length > 0 && (
            <Card>
              <TintCardTitle icon={History} title="Historial" />
              <ol className="flex flex-col gap-3 border-l-2 border-[color-mix(in_srgb,var(--tint)_25%,transparent)] pl-4">
                {reservation.history.map((event, index) => (
                  <li key={index} className="relative text-[13px]">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-[var(--tint)]" />
                    <b className="font-semibold">{ACTION_LABEL[event.action] ?? event.action.replaceAll("_", " ")}</b>
                    <span className="block text-xs text-fg-3">
                      {formatDateTime(event.occurred_at)}
                      {event.after_value && !HIDDEN_VALUE.has(event.action) ? ` · ${event.after_value}` : ""}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </div>
      </div>
      </ReservationLockScope>
    </ToneScope>
  );
}
