import { CalendarDays, ClipboardCheck, ClipboardList, FileText, History, LayoutDashboard, MapPin, MessageSquareText, Receipt, Route, Scale, Sparkles, TriangleAlert, UserRound, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shell/PageHeader";
import { LiveTag, StatusBadge } from "@/components/ui/Badge";
import { DownloadButton } from "@/components/ui/DownloadButton";
import { InfoTip } from "@/components/ui/InfoTip";
import { SectionLayout, SectionNav } from "@/components/ui/SectionNav";
import { resolveSections } from "@/lib/sections";
import { HeroBand, HeroChip, HeroPanel, TintTile, ToneScope } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { amountAttr, formatDate, formatDateTime, formatMoney, shortName } from "@/lib/format";
import { PendingChanges, ReservationModifyAction, ReservationRescheduleAction } from "@/features/reservations/ReservationChangeActions";
import { ReservationCancelAction, ReservationEditAction, ReservationRejectRequestAction, ReservationRequestCancelAction } from "@/features/reservations/ReservationActions";
import { ReservationOrderAction, ReservationReassignAction, ReservationStateActions } from "@/features/reservations/ReservationLifecycleActions";
import { ReservationLockScope } from "@/features/reservations/ReservationLock";
import { DocumentsSection, FeedbackSection, HistorySection, IncidentsSection, OperationSection, PassengersSection, PaymentsSection, ServicesSection, SummarySection, WebSection } from "@/features/reservations/ReservationSections";
import type { ReceivablesOverview, SettlementDetail } from "@/lib/finance";
import { SettlementSection } from "@/features/finance/Settlement";
import { CLOSED_RESERVATION, type ReservationService } from "@/lib/reservations";
import { getAdvisors } from "@/lib/server/leads";
import { currentUser } from "@/lib/server/me";
import { getChangeOptions, getReservation, getReservationCancellation, getReservationFeedback, getReservationHistory, getReservationPaxMessages, getReservationWebSnapshot } from "@/lib/server/reservations";
import { getResource } from "@/lib/server/resource";
import { statusTone } from "@/lib/tone";

export async function generateMetadata({ params }: PageProps<"/reservas/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: (await getReservation(code)).title };
}

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
  solicitar: "Solicitado al proveedor",
  confirmar_proveedor: "Confirmado por el proveedor",
  rechazar: "Rechazado por el proveedor",
};

const CONFIRMED_SERVICE = ["confirmado", "en_curso", "completado"];

function OperationsFigures({ services, currency }: { services: ReservationService[]; currency: string }) {
  const live = services.filter((service) => !service.replaced && !["cancelado", "rechazado"].includes(service.status));
  const confirmed = live.filter((service) => CONFIRMED_SERVICE.includes(service.status)).length;
  const cost = live.reduce((sum, service) => sum + Number(service.cost ?? 0), 0);
  const pct = live.length > 0 ? Math.round((confirmed / live.length) * 100) : 0;
  return (
    <div className="grid max-w-md grid-cols-2 gap-5">
      <div>
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-white/70">
          Costo de proveedores
          <InfoTip label="Vista de Operaciones">Servicios, pasajeros y costo de proveedores. Los importes de venta y los cobros los lleva Finanzas.</InfoTip>
        </p>
        <p className="mt-1 text-[30px] font-bold leading-none tracking-[-0.03em]">{formatMoney(cost, currency)}</p>
      </div>
      <div>
        <p className="text-[13px] font-medium text-white/70">Servicios confirmados</p>
        <p className="mt-1 text-[30px] font-bold leading-none tracking-[-0.03em]">
          {confirmed}
          <span className="text-[18px] font-semibold text-white/60"> de {live.length}</span>
        </p>
        <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-white/20">
          <span className="block h-full rounded-full bg-white" style={{ width: `${pct}%` }} />
        </span>
      </div>
    </div>
  );
}

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default async function ReservaPage({ params, searchParams }: PageProps<"/reservas/[code]">) {
  const { code } = await params;
  const query = await searchParams;
  const reservation = await getReservation(code);
  const closed = CLOSED_RESERVATION.includes(reservation.status);
  const canCancel = !closed && (reservation.can.cancel || reservation.can.request_cancel);
  const [preview, advisors, changeOptions] = await Promise.all([canCancel ? getReservationCancellation(code) : null, reservation.can.reassign ? getAdvisors() : [], !closed && reservation.can.modify ? getChangeOptions(code) : null]);
  const editable = !closed && reservation.can.modify;
  const printable = !["borrador", "cancelada"].includes(reservation.status);
  const receivables = reservation.receivables;
  const charged = (receivables ?? []).filter((item) => item.status !== "cancelada");
  const totalCharged = charged.reduce((sum, item) => sum + Number(item.amount), 0);
  const totalPaid = charged.reduce((sum, item) => sum + Number(item.paid_amount), 0);
  const paidPct = totalCharged > 0 ? Math.round((totalPaid / totalCharged) * 100) : 0;
  const overdue = charged.some((item) => item.status === "vencida");
  const traveling = reservation.travel_from <= reservation.today && reservation.travel_to >= reservation.today && reservation.status !== "cancelada";
  const base = `/reservas/${encodeURIComponent(reservation.code)}`;
  const orderAction = reservation.can.operation_order ? <ReservationOrderAction code={reservation.code} /> : null;

  const { active: current, groups } = resolveSections(base, [
    { group: "Reserva", id: "resumen", label: "Resumen", icon: <LayoutDashboard size={15} /> },
    { group: "Reserva", id: "pasajeros", label: "Pasajeros", icon: <Users size={15} />, count: reservation.passengers.length },
    { group: "Reserva", id: "servicios", label: "Servicios", icon: <Route size={15} />, count: reservation.services.length },
    { group: "Reserva", id: "web", label: "Reserva web", icon: <Sparkles size={15} />, show: reservation.counts.web > 0 },
    { group: "Cobros y documentos", id: "pagos", label: "Pagos", icon: <Wallet size={15} />, count: reservation.payments?.length, show: receivables !== undefined },
    { group: "Cobros y documentos", id: "documentos", label: "Documentos", icon: <FileText size={15} />, count: reservation.vouchers.length + (reservation.invoices?.length ?? 0) },
    { group: "Cobros y documentos", id: "liquidacion", label: "Liquidación", icon: <Scale size={15} />, show: reservation.view.margin },
    { group: "Operación", id: "operacion", label: "Operación", icon: <ClipboardList size={15} />, show: reservation.operation !== null || orderAction !== null || reservation.view.mode === "operations" },
    { group: "Operación", id: "incidencias", label: "Incidencias", icon: <TriangleAlert size={15} />, count: reservation.incidents.length },
    { group: "Operación", id: "comentarios", label: "Comentarios", icon: <MessageSquareText size={15} />, count: reservation.counts.feedback },
    { group: "Control", id: "historial", label: "Historial", icon: <History size={15} /> },
  ], query.seccion);

  const body = await (async () => {
    switch (current) {
      case "pasajeros":
        return <PassengersSection reservation={reservation} editable={editable} />;
      case "servicios":
        return <ServicesSection reservation={reservation} />;
      case "web":
        return <WebSection snapshot={await getReservationWebSnapshot(code)} currency={reservation.currency} />;
      case "liquidacion":
        return <SettlementSection data={await getResource<SettlementDetail>(`/finance/reservations/${encodeURIComponent(code)}/settlement`, "No pudimos cargar la liquidación.")} />;
      case "pagos":
        return <PaymentsSection reservation={reservation} finance={await getResource<ReceivablesOverview>("/finance/receivables", "No pudimos cargar las cuentas por cobrar.")} />;
      case "documentos":
        return <DocumentsSection reservation={reservation} printable={printable} />;
      case "operacion":
        return <OperationSection reservation={reservation} orderAction={orderAction} />;
      case "incidencias":
        return <IncidentsSection reservation={reservation} />;
      case "comentarios": {
        const [feedback, messages, me] = await Promise.all([getReservationFeedback(code), getReservationPaxMessages(code), currentUser()]);
        return <FeedbackSection feedback={feedback ?? []} messages={messages ?? []} canEscalate={me.permissions.includes("operations.incidents")} canReply={["channels.b2b.manage", "channels.cms.publish", "operations.assign"].some((permission) => me.permissions.includes(permission))} />;
      }
      case "historial":
        return <HistorySection events={await getReservationHistory(code)} labels={ACTION_LABEL} />;
      default:
        return <SummarySection reservation={reservation} />;
    }
  })();

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
                    {reservation.can.modify && <ReservationEditAction reservation={reservation} defaultOpen={one(query.editar) === "1"} />}
                    {reservation.can.reassign && advisors.length > 0 && <ReservationReassignAction reservation={reservation} advisors={advisors} />}
                    {orderAction}
                    {changeOptions && <ReservationModifyAction code={reservation.code} currency={reservation.currency} options={changeOptions} />}
                    {changeOptions && <ReservationRescheduleAction code={reservation.code} />}
                    {preview && reservation.can.cancel && <ReservationCancelAction reservation={reservation} preview={preview} defaultOpen={one(query.cancelar) === "1"} />}
                    {preview && reservation.can.request_cancel && !reservation.cancel_request && <ReservationRequestCancelAction reservation={reservation} preview={preview} defaultOpen={one(query.cancelar) === "1"} />}
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
                <OperationsFigures services={reservation.services} currency={reservation.currency} />
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

        {reservation.status === "pendiente_disponibilidad" && (
          <p data-testid="reservation-notice-availability" className="mb-5 rounded-card border border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-4 py-3 text-[13.5px]">
            <b className="font-semibold">Pendiente de disponibilidad.</b> Uno o más servicios no tienen cupo retenido. No se puede confirmar hasta contar con disponibilidad.
          </p>
        )}

        {reservation.status === "reprogramada" && (
          <p data-testid="reservation-notice-rescheduled" className="mb-5 rounded-card border border-[color-mix(in_srgb,var(--info)_35%,transparent)] bg-[color-mix(in_srgb,var(--info)_9%,transparent)] px-4 py-3 text-[13.5px]">
            <b className="font-semibold">Reprogramada{reservation.rescheduled_at ? ` el ${formatDateTime(reservation.rescheduled_at)}` : ""}.</b> Vuelve a pedir los servicios a los proveedores y reemite los vouchers.
          </p>
        )}

        {!closed && !reservation.cancel_request && reservation.cancel_rejected && (
          <p data-testid="reservation-notice-cancel-rejected" className="mb-5 rounded-card border border-line bg-surface-2 px-4 py-3 text-[13.5px] text-fg-2">
            <b className="font-semibold text-fg">Solicitud de anulación rechazada</b>
            {reservation.cancel_rejected.decided_by ? ` por ${reservation.cancel_rejected.decided_by}` : ""}
            {reservation.cancel_rejected.decided_at ? ` el ${formatDateTime(reservation.cancel_rejected.decided_at)}` : ""}
            {reservation.cancel_rejected.decision_note ? `: «${reservation.cancel_rejected.decision_note}»` : "."}
          </p>
        )}

        {!closed && <PendingChanges code={reservation.code} currency={reservation.currency} changes={reservation.changes} canApprove={reservation.can.approve_changes} />}

        <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <TintTile icon={UserRound} tone="t1" label="Cliente" value={<Link href={`/crm/clientes/${reservation.client.code}`} className="text-[16px] hover:underline">{reservation.client.name}</Link>} />
          <TintTile icon={Users} tone="t4" label="Responsable" value={<span className="text-[16px]">{shortName(reservation.owner.name)}</span>} note={reservation.sede ?? undefined} />
          <TintTile icon={FileText} tone="violet" label="Cotización" value={<span className="text-[16px]">{reservation.quote ? <Link href={`/cotizaciones/${reservation.quote.code}`} className="hover:underline">{reservation.quote.code}</Link> : "Venta directa"}</span>} />
          <TintTile icon={reservation.margin_pct === undefined ? ClipboardCheck : Receipt} tone="sun" label={reservation.margin_pct === undefined ? "Servicios confirmados" : "Margen"} value={reservation.margin_pct === undefined ? `${reservation.services.filter((service) => !service.replaced && CONFIRMED_SERVICE.includes(service.status)).length} de ${reservation.services.filter((service) => !service.replaced && !["cancelado", "rechazado"].includes(service.status)).length}` : reservation.margin_pct === null ? <span className="text-[14px] text-fg-3">Sin servicios activos</span> : `${reservation.margin_pct} %`} />
        </section>

        <SectionLayout nav={<SectionNav label="Secciones de la reserva" groups={groups} active={current} testId="reservation-sections" />}>{body}</SectionLayout>
      </ReservationLockScope>
    </ToneScope>
  );
}
