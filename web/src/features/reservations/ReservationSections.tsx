import { BedDouble, CalendarClock, ClipboardCheck, ClipboardList, Coins, FileText, History, MessageSquareText, Plane, Receipt, Route, ScrollText, Send, Sparkles, Star, TicketCheck, TriangleAlert, Users, Wallet } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AuditWhen, AuditWho } from "@/components/table/AuditCells";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { MiniTable, ProgressBar } from "@/components/ui/MiniTable";
import { DownloadButton } from "@/components/ui/DownloadButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { SOFT_TINT, TintCardTitle, ToneScope } from "@/components/ui/Tinted";
import { RegisterPaymentAction } from "@/features/finance/Receivables";
import { cn } from "@/lib/cn";
import type { ReceivablesOverview } from "@/lib/finance";
import { amountAttr, formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { FeedbackIncidentAction } from "@/features/operations/FeedbackIncidentAction";
import { FeedbackReplyActions } from "./FeedbackReplyActions";
import { daysBetween, PolicyLadder } from "./PolicyLadder";
import { InfoTip } from "@/components/ui/InfoTip";
import { CHANGE_TYPE, DOC_TYPE, PAX_TYPE, SERVICE_KIND, type ReservationDetail, type ReservationFeedback, type ReservationHistoryEvent, type ReservationPaxMessage, type ReservationWebSnapshot } from "@/lib/reservations";
import { statusLabel } from "@/lib/tone";
import { PassengerAddAction, PassengerRowActions } from "./ReservationActions";
import { RequestPendingServicesAction, ReservationReceivablesAction, ServiceRowActions } from "./ReservationLifecycleActions";

const dayLabel = (iso: string) => formatDate(iso, "long");

function Empty({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <Card>
      <EmptyState icon={icon} title={title} description={description} />
    </Card>
  );
}

const SERVICE_STATES = [
  { key: "completado", label: "Completados", tone: "bg-t3" },
  { key: "en_curso", label: "En curso", tone: "bg-t1" },
  { key: "confirmado", label: "Confirmados", tone: "bg-ok" },
  { key: "solicitado", label: "Solicitados", tone: "bg-info" },
  { key: "pendiente", label: "Pendientes", tone: "bg-warn" },
  { key: "rechazado", label: "Rechazados", tone: "bg-bad" },
];

export function SummarySection({ reservation }: { reservation: ReservationDetail }) {
  const active = reservation.services.filter((service) => service.status !== "cancelado" && !service.replaced);
  const counts = SERVICE_STATES.map((state) => ({ ...state, value: active.filter((service) => service.status === state.key).length }));
  const price = active.reduce((sum, service) => sum + Number(service.price ?? 0), 0);
  const cost = active.reduce((sum, service) => sum + Number(service.cost ?? 0), 0);
  const seesMargin = reservation.view.margin;
  const operationsView = reservation.view.mode === "operations";
  const byProvider = Object.entries(
    active.reduce<Record<string, number>>((acc, service) => {
      const name = service.provider?.name ?? "Sin proveedor";
      acc[name] = (acc[name] ?? 0) + Number(service.cost ?? 0);
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <TintCardTitle icon={ClipboardCheck} title="Estado de los servicios" aside={`${active.length} activos`} />
          <div className="mb-3 flex h-2.5 overflow-hidden rounded-full bg-surface-2">
            {counts.map((state) => state.value > 0 && <span key={state.key} className={cn("h-full transition-[width] duration-700", state.tone)} style={{ width: `${(state.value / Math.max(1, active.length)) * 100}%` }} title={`${state.label}: ${state.value}`} />)}
          </div>
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {counts.filter((state) => state.value > 0 || !["en_curso", "completado"].includes(state.key)).map((state) => (
              <li key={state.key} className={cn("lift rounded-[12px] px-3 py-2.5", SOFT_TINT)}>
                <span className="flex items-center gap-1.5 text-[12px] text-fg-3">
                  <span className={cn("h-2 w-2 rounded-full", state.tone)} />
                  {state.label}
                </span>
                <b className="text-[18px] font-bold tabular-nums">{state.value}</b>
              </li>
            ))}
          </ul>
        </Card>

        {seesMargin ? (
          <Card>
            <TintCardTitle icon={Coins} title="Economía" />
            <FieldList
              fields={[
                { label: "Venta sin IGV", value: <span className="font-mono">{formatMoney(reservation.economics?.sale_net ?? price, reservation.currency)}</span> },
                { label: "Costo de proveedores", value: <span className="font-mono">{formatMoney(cost, reservation.currency)}</span> },
                { label: "Utilidad bruta", value: <b className="font-mono">{formatMoney(reservation.economics?.profit ?? price - cost, reservation.currency)}</b> },
              ]}
            />
          </Card>
        ) : operationsView ? (
          <Card>
            <TintCardTitle icon={Coins} title="Costos por proveedor" aside={formatMoney(cost, reservation.currency)} />
            <ul className="flex flex-col">
              {byProvider.map(([name, amount]) => (
                <li key={name} className="flex items-center justify-between gap-3 border-t border-line-2 py-2 text-[13px] first:border-t-0">
                  <span className="truncate">{name}</span>
                  <span className="font-mono">{formatMoney(amount, reservation.currency)}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <Card>
            <TintCardTitle icon={FileText} title="Datos de la reserva" />
            <ReservationFacts reservation={reservation} />
          </Card>
        )}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {(seesMargin || operationsView) && (
          <Card>
            <TintCardTitle icon={FileText} title="Datos de la reserva" />
            <ReservationFacts reservation={reservation} />
          </Card>
        )}
        <Card>
          <TintCardTitle icon={CalendarClock} title="Modificaciones y reprogramaciones" aside={reservation.change_log.length ? String(reservation.change_log.length) : undefined} />
          {reservation.change_log.length === 0 ? (
            <p className="text-[13.5px] text-fg-3">La reserva no ha tenido cambios desde que se creó.</p>
          ) : (
            <ol className="flex flex-col gap-3 border-l-2 border-[color-mix(in_srgb,var(--tint)_25%,transparent)] pl-4">
              {reservation.change_log.map((change, index) => (
                <li key={index} className="relative text-[13px]">
                  <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-[var(--tint)]" />
                  <span className="flex flex-wrap items-center gap-2">
                    <b className="font-semibold">{CHANGE_TYPE[change.type] ?? change.type}</b>
                    <StatusBadge status={change.status} />
                    {change.delta_amount && Number(change.delta_amount) !== 0 && <span className="font-mono text-[12.5px] text-fg-2">{Number(change.delta_amount) > 0 ? "+" : ""}{formatMoney(change.delta_amount, reservation.currency)}</span>}
                  </span>
                  <span className="block text-fg-2">{change.description}</span>
                  <span className="block text-xs text-fg-3">
                    {formatDateTime(change.requested_at)}
                    {change.requested_by && ` · pidió ${change.requested_by}`}
                    {change.decided_by && ` · decidió ${change.decided_by}`}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
        <Card className={cn((seesMargin || operationsView) && "xl:col-span-2")}>
          <TintCardTitle icon={ScrollText} title="Políticas aplicadas" aside={reservation.policies.source === "product" ? <InfoTip label="Políticas vigentes del producto">La reserva no guardó copia de las políticas al crearse; se muestran las vigentes de cada producto.</InfoTip> : undefined} />
          {reservation.policies.items.length === 0 ? (
            <p className="text-[13.5px] text-fg-3">Los productos de esta reserva no tienen políticas registradas.</p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {reservation.policies.items.map((policy) => (
                <PolicyLadder
                  key={policy.product}
                  product={policy.product}
                  tiers={policy.tiers ?? []}
                  daysToTravel={daysBetween(reservation.today, reservation.travel_from)}
                  texts={[
                    { label: "Cancelación", value: policy.cancellation },
                    { label: "Cambios", value: policy.modification },
                    { label: "No presentarse", value: policy.no_show },
                    { label: "Reembolsos", value: policy.refund },
                  ]}
                />
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function ReservationFacts({ reservation }: { reservation: ReservationDetail }) {
  return (
    <FieldList
      fields={[
        { label: "Creada", value: formatDateTime(reservation.created_at) },
        { label: "Origen", value: reservation.quote ? `Cotización ${reservation.quote.code}` : reservation.counts.web > 0 ? "Sitio web" : "Venta directa" },
        { label: "Copia del catálogo", value: <span className="whitespace-normal">{reservation.snapshot_label ?? "Sin copia"}</span> },
        { label: "Moneda", value: reservation.currency },
        { label: "Notas", value: <span className="whitespace-normal">{reservation.notes || "Sin notas"}</span> },
      ]}
    />
  );
}

function ageOf(birth: string | null, today: string) {
  if (!birth) return null;
  const [y, m, d] = birth.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = today.slice(0, 10).split("-").map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

export function PassengersSection({ reservation, editable }: { reservation: ReservationDetail; editable: boolean }) {
  const pending = reservation.passengers.filter((passenger) => passenger.is_placeholder || !passenger.doc_number || !passenger.nationality || !passenger.birth_date).length;
  return (
    <Card>
      <TintCardTitle icon={Users} title="Pasajeros" aside={editable ? <PassengerAddAction code={reservation.code} /> : String(reservation.passengers.length)} />
      {pending > 0 && <p className="mb-3 rounded-[12px] border border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-3 py-2 text-[13px]">{pending === 1 ? "1 pasajero tiene datos por completar" : `${pending} pasajeros tienen datos por completar`}: documento, nacionalidad o fecha de nacimiento. Son necesarios para emitir vouchers y entradas nominativas.</p>}
      <MiniTable head={["Pasajero", "Tipo", "Edad", "Documento", "Nacionalidad", "Contacto", "Dieta", ...(editable ? [""] : [])]}>
        {reservation.passengers.map((passenger) => {
          const age = passenger.age ?? ageOf(passenger.birth_date, reservation.today);
          return (
            <tr key={passenger.id} data-testid={`reservation-passenger:${passenger.id}`}>
              <td>
                <b className="block font-semibold">
                  {passenger.full_name}
                  {passenger.is_lead && <span className="ml-1.5 text-[11.5px] font-medium text-[var(--tint)]">Titular</span>}
                </b>
                {passenger.relationship && !(passenger.is_lead && passenger.relationship === "Titular") && <span className="block text-xs text-fg-3">{passenger.relationship}</span>}
              </td>
              <td>
                {PAX_TYPE[passenger.pax_type] ?? passenger.pax_type}
                {passenger.age_warning && (
                  <span className="mt-0.5 flex items-center gap-1 text-xs text-warn" title={passenger.age_warning}>
                    <TriangleAlert size={12} />
                    Revisar tipo por edad
                  </span>
                )}
              </td>
              <td className="tabular-nums">
                {age ?? "—"}
                {passenger.birth_date && <span className="block text-xs text-fg-3">{formatDate(passenger.birth_date)}</span>}
              </td>
              <td>{passenger.doc_number ? `${passenger.doc_type ?? ""} ${passenger.doc_number}`.trim() : <span className="text-warn">Por completar</span>}</td>
              <td>{passenger.nationality ?? <span className="text-warn">Por completar</span>}</td>
              <td className="text-xs">
                {passenger.phone && <span className="block">{passenger.phone}</span>}
                {passenger.email && <span className="block text-fg-3">{passenger.email}</span>}
                {!passenger.phone && !passenger.email && "—"}
              </td>
              <td>{passenger.diet_notes ?? "—"}</td>
              {editable && (
                <td className="text-right">
                  <PassengerRowActions code={reservation.code} passenger={passenger} canRemove={reservation.passengers.length > 1} />
                </td>
              )}
            </tr>
          );
        })}
      </MiniTable>
    </Card>
  );
}

export function ServicesSection({ reservation }: { reservation: ReservationDetail }) {
  const days = [...new Set(reservation.services.map((service) => service.date))];
  const pendingServices = reservation.services.filter((service) => service.status === "pendiente" && service.provider?.active).length;
  const showPrice = reservation.view.margin;
  const active = reservation.services.filter((service) => service.status !== "cancelado" && !service.replaced);

  return (
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
                            {service.provider ? (
                              service.provider.ref ? (
                                <Link href={`/catalogo/proveedores/${service.provider.ref}`} className="hover:text-[var(--tint)] hover:underline">
                                  {service.provider.name}
                                </Link>
                              ) : (
                                service.provider.name
                              )
                            ) : (
                              kind.label
                            )}
                            {service.departure ? ` · salida ${service.departure}` : ""}
                            {service.confirmation ? ` · ${service.confirmation}` : ""}
                            {service.alt_of ? ` · alternativa de ${service.alt_of}` : ""}
                          </span>
                          {service.status === "rechazado" && service.reject_reason && <span className="block text-xs text-bad">{service.reject_reason}</span>}
                        </span>
                        {service.cost !== undefined && (
                          <span className="flex-none text-right font-mono text-[12.5px]">
                            {showPrice && service.price !== undefined && <b className="block font-semibold">{formatMoney(service.price, service.currency)}</b>}
                            <span className="text-fg-3" title="Costo del proveedor">
                              {showPrice ? "costo " : ""}
                              {formatMoney(service.cost, service.currency)}
                            </span>
                          </span>
                        )}
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
      {showPrice && active.length > 0 && (
        <p className="mt-4 flex justify-end gap-6 border-t border-line-2 pt-3 text-[13px]">
          <span>
            Venta <b className="font-mono">{formatMoney(active.reduce((sum, service) => sum + Number(service.price ?? 0), 0), reservation.currency)}</b>
          </span>
          <span className="text-fg-2">
            Costo <b className="font-mono">{formatMoney(active.reduce((sum, service) => sum + Number(service.cost ?? 0), 0), reservation.currency)}</b>
          </span>
        </p>
      )}
    </Card>
  );
}

export function PaymentsSection({ reservation, finance }: { reservation: ReservationDetail; finance: ReceivablesOverview | null }) {
  const receivables = (reservation.receivables ?? []).filter((item) => item.status !== "cancelada");
  const payments = reservation.payments ?? [];
  const rows = finance?.rows.filter((row) => row.reservation.code === reservation.code) ?? [];
  const totals = receivables.reduce((acc, item) => ({ amount: acc.amount + Number(item.amount), paid: acc.paid + Number(item.paid_amount) }), { amount: 0, paid: 0 });

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <TintCardTitle icon={Receipt} title="Cuentas por cobrar" aside={reservation.can.generate_receivables ? <ReservationReceivablesAction code={reservation.code} /> : undefined} />
        {receivables.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">Sin cuotas programadas.</p>
        ) : (
          <>
            <MiniTable head={["Cuota", "Vence", "Monto", "Pagado", "Saldo", "Estado", ""]} align={["left", "left", "right", "right", "right", "left", "right"]}>
              {receivables.map((item) => {
                const row = rows.find((candidate) => candidate.code === item.code);
                const balance = Number(item.amount) - Number(item.paid_amount);
                return (
                  <tr key={item.code} data-testid={`reservation-receivable:${item.kind}`} data-amount={amountAttr(item.amount)} data-due={item.due_date.slice(0, 10)}>
                    <td>
                      <b className="block font-semibold">{item.concept}</b>
                      <span className="text-xs text-fg-3">{item.code}</span>
                    </td>
                    <td>{formatDate(item.due_date)}</td>
                    <td className="text-right font-mono">{formatMoney(item.amount, item.currency)}</td>
                    <td className="text-right font-mono text-ok">{formatMoney(item.paid_amount, item.currency)}</td>
                    <td className={cn("text-right font-mono", balance > 0 && item.status === "vencida" && "text-bad")}>{formatMoney(balance, item.currency)}</td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="text-right">{row && finance && finance.can.register && balance > 0 && <RegisterPaymentAction row={row} methods={finance.methods} today={finance.today} usdRate={finance.usd_rate} />}</td>
                  </tr>
                );
              })}
            </MiniTable>
            <div className="mt-3 border-t border-line-2 pt-3">
              <ProgressBar value={totals.amount > 0 ? (totals.paid / totals.amount) * 100 : 0} tone={receivables.some((item) => item.status === "vencida") ? "bad" : "ok"} />
              <p className="mt-2 flex justify-between text-[13px]">
                <span>
                  Pagado <b className="font-mono">{formatMoney(totals.paid, reservation.currency)}</b> de {formatMoney(totals.amount, reservation.currency)}
                </span>
                <span>
                  Saldo <b className="font-mono">{formatMoney(Math.max(0, totals.amount - totals.paid), reservation.currency)}</b>
                </span>
              </p>
            </div>
          </>
        )}
      </Card>
      <Card>
        <TintCardTitle icon={Wallet} title="Pagos registrados" aside={payments.length ? String(payments.length) : undefined} />
        {payments.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">Todavía no hay pagos registrados para esta reserva.</p>
        ) : (
          <MiniTable head={["Pago", "Fecha", "Medio", "Cuota", "Monto", "Estado"]} align={["left", "left", "left", "left", "right", "left"]}>
            {payments.map((payment) => (
              <tr key={payment.code}>
                <td>
                  <b className="block font-semibold">{payment.code}</b>
                  {payment.reference && <span className="text-xs text-fg-3">Operación {payment.reference}</span>}
                </td>
                <td>{formatDate(payment.paid_on)}</td>
                <td className="first-letter:uppercase">{payment.method.replaceAll("_", " ")}</td>
                <td className="text-xs">{payment.receivable_concept ?? "—"}</td>
                <td className="text-right font-mono">{formatMoney(payment.amount, payment.currency)}</td>
                <td>
                  <StatusBadge status={payment.status} />
                  {payment.reject_reason && <span className="block text-xs text-bad">{payment.reject_reason}</span>}
                </td>
              </tr>
            ))}
          </MiniTable>
        )}
      </Card>
    </div>
  );
}

export function DocumentsSection({ reservation, printable }: { reservation: ReservationDetail; printable: boolean }) {
  const invoices = reservation.invoices ?? [];
  return (
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <Card>
        <TintCardTitle icon={FileText} title="Documentos comerciales" />
        <ul className="flex flex-col gap-2">
          {printable && (
            <li className="flex items-center gap-3 rounded-[12px] border border-line-2 px-3 py-2.5 text-[13px]">
              <span className="min-w-0 flex-1">
                <b className="block font-semibold">Confirmación de reserva</b>
                <span className="text-xs text-fg-3">PDF con servicios, pasajeros y políticas</span>
              </span>
              <DownloadButton href={`/reservas/${reservation.code}/confirmacion`} label="Descargar confirmación" size="sm" variant="ghost" iconOnly />
            </li>
          )}
          {reservation.quote && (
            <li className="flex items-center gap-3 rounded-[12px] border border-line-2 px-3 py-2.5 text-[13px]">
              <span className="min-w-0 flex-1">
                <b className="block font-semibold">Cotización aprobada</b>
                <span className="text-xs text-fg-3">
                  {reservation.quote.code} · {reservation.quote.title}
                </span>
              </span>
              <Link href={`/cotizaciones/${reservation.quote.code}`} className="text-[12.5px] font-semibold text-[var(--tint)] hover:underline">
                Abrir
              </Link>
            </li>
          )}
          {!printable && !reservation.quote && <p className="text-[13.5px] text-fg-3">La confirmación se genera cuando la reserva sale de borrador.</p>}
        </ul>
      </Card>
      {reservation.invoices !== undefined && (
        <Card>
          <TintCardTitle icon={Receipt} title="Comprobantes electrónicos" aside={invoices.length ? String(invoices.length) : undefined} />
          {invoices.length === 0 ? (
            <p className="text-[13.5px] text-fg-3">No se han emitido facturas, boletas ni notas de crédito para esta reserva.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {invoices.map((invoice) => (
                <li key={invoice.number} className="lift flex items-center gap-3 rounded-[12px] border border-line-2 px-3 py-2.5 text-[13px] hover:bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <Link href={`/finanzas/facturacion/${invoice.number}`} className="block truncate font-semibold hover:underline">
                      {DOC_TYPE[invoice.doc_type] ?? "Comprobante"} {invoice.number}
                    </Link>
                    <span className="text-xs text-fg-3">
                      {formatDate(invoice.issue_date)}
                      {invoice.description ? ` · ${invoice.description}` : ""}
                    </span>
                  </span>
                  <span className="font-mono">{formatMoney(invoice.total_amount, invoice.currency)}</span>
                  <StatusBadge status={invoice.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      <Card className="xl:col-span-2">
        <TintCardTitle icon={TicketCheck} title="Vouchers" aside={reservation.vouchers.length ? String(reservation.vouchers.length) : undefined} />
        {reservation.vouchers.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">Los vouchers se emiten cuando el proveedor confirma cada servicio.</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {reservation.vouchers.map((voucher) => (
              <li key={voucher.code} className="lift flex items-center gap-3 rounded-[12px] border border-line-2 px-3 py-2.5 text-[13px] hover:bg-surface-2">
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
        )}
      </Card>
    </div>
  );
}

export function OperationSection({ reservation, orderAction }: { reservation: ReservationDetail; orderAction: ReactNode }) {
  const operation = reservation.operation;
  if (!operation) {
    return <Empty icon={<ClipboardList size={20} />} title="Sin orden operativa" description={orderAction ? "Genera la orden para asignar guía, conductor y vehículo y seguir las tareas del viaje." : "La orden operativa se genera cuando la reserva está confirmada."} />;
  }
  const done = operation.tasks.filter((task) => task.done).length;
  return (
    <div className="grid items-start gap-5">
      <Card>
        <TintCardTitle icon={ClipboardList} title="Orden operativa" aside={<StatusBadge status={operation.status} />} />
        <FieldList
          fields={[
            { label: "Orden", value: <Link href={`/operaciones/ordenes/${operation.code}`} className="font-semibold text-[var(--tint)] hover:underline">{operation.code}</Link> },
            { label: "Coordinador", value: operation.coordinator ?? "Sin asignar" },
            { label: "Periodo", value: `${formatDate(operation.date_from)} al ${formatDate(operation.date_to)}` },
          ]}
        />
        {operation.tasks.length > 0 && (
          <div className="mt-4">
            <p className="mb-1.5 flex justify-between text-[13px] font-semibold">
              Tareas
              <span className="font-normal text-fg-3">
                {done} de {operation.tasks.length}
              </span>
            </p>
            <ProgressBar value={(done / operation.tasks.length) * 100} />
            <ul className="mt-3 flex flex-col gap-1.5">
              {operation.tasks.map((task) => (
                <li key={task.title} className={cn("flex items-center gap-2 text-[13px]", task.done && "text-fg-3 line-through")}>
                  <span className={cn("h-2 w-2 flex-none rounded-full", task.done ? "bg-ok" : "bg-line")} />
                  {task.title}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
      <Card>
        <TintCardTitle icon={Users} title="Asignaciones" aside={String(operation.assignments.length)} />
        {operation.assignments.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">Todavía no se asignaron guías, conductores ni vehículos.</p>
        ) : (
          <MiniTable head={["Servicio", "Guía", "Conductor", "Vehículo", "Estado"]}>
            {operation.assignments.map((item, index) => (
              <tr key={index}>
                <td>
                  <b className="block font-semibold">{item.service_label}</b>
                  <span className="text-xs text-fg-3">
                    {formatDate(item.service_date)}
                    {item.service_time ? ` · ${item.service_time}` : ""}
                  </span>
                </td>
                <td>{item.guide ?? <span className="text-fg-3">Sin asignar</span>}</td>
                <td>{item.driver ?? <span className="text-fg-3">Sin asignar</span>}</td>
                <td>{item.vehicle ? `${item.vehicle}${item.vehicle_type ? ` · ${item.vehicle_type}` : ""}` : <span className="text-fg-3">Sin asignar</span>}</td>
                <td>
                  <StatusBadge status={item.status} />
                </td>
              </tr>
            ))}
          </MiniTable>
        )}
      </Card>
    </div>
  );
}

export function IncidentsSection({ reservation }: { reservation: ReservationDetail }) {
  if (reservation.incidents.length === 0) return <Empty icon={<TriangleAlert size={20} />} title="Sin incidencias" description="No se reportaron incidencias en este viaje." />;
  return (
    <ToneScope tone="bad">
      <Card>
        <TintCardTitle icon={TriangleAlert} title="Incidencias" aside={String(reservation.incidents.length)} />
        <ul className="flex flex-col gap-2">
          {reservation.incidents.map((incident) => (
            <li key={incident.code} className={cn("flex items-center gap-3 rounded-[12px] px-3 py-2.5 text-[13px]", SOFT_TINT)}>
              <span className="min-w-0 flex-1">
                <Link href={`/operaciones/incidencias/${incident.code}`} className="block font-semibold hover:underline">
                  {incident.title}
                </Link>
                <span className="text-xs text-fg-3">
                  {incident.code} · {incident.type} · gravedad {incident.severity} · {formatDate(incident.created_at)}
                </span>
              </span>
              <StatusBadge status={incident.status} />
            </li>
          ))}
        </ul>
      </Card>
    </ToneScope>
  );
}

const WEB_RULES: Record<string, { label: string; icon: typeof ScrollText }> = {
  "R-DEPOSIT": { label: "Adelanto", icon: Wallet },
  "R-PAY-LATER": { label: "Pagar después", icon: CalendarClock },
  "R-PICKUP": { label: "Recojo", icon: Plane },
  "R-COMMENTS": { label: "Comentarios", icon: MessageSquareText },
  "R-COMPANIONS": { label: "Acompañantes", icon: Users },
  "R-LODGING": { label: "Alojamiento", icon: BedDouble },
  "R-ADDONS": { label: "Adicionales", icon: Sparkles },
  "R-PROMO": { label: "Promoción", icon: Receipt },
  "R-SEASON": { label: "Temporada", icon: CalendarClock },
};

function HistoricTag({ rules, inactive }: { rules: string[]; inactive: string[] }) {
  const off = rules.filter((rule) => inactive.includes(rule));
  if (off.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {off.map((rule) => (
        <Badge key={rule} tone="mute" dot={false} testId="web-rule-inactive">
          {rule} inactiva · dato histórico
        </Badge>
      ))}
    </span>
  );
}

export function WebSection({ snapshot, currency }: { snapshot: ReservationWebSnapshot | null; currency: string }) {
  if (!snapshot) return <Empty icon={<Sparkles size={20} />} title="No es una reserva web" description="Esta reserva no se hizo desde el sitio público, así que no tiene datos del carrito ni del pago en línea." />;
  const lineLabel = (line: { label?: string; name?: string; reason?: string }) => line.label ?? line.name ?? line.reason ?? "Concepto";
  const inactive = snapshot.rules_inactive ?? [];
  return (
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <Card>
        <TintCardTitle icon={Sparkles} title="Compra en el sitio" aside={<span className="flex items-center gap-2">{snapshot.currency_display !== snapshot.charge_currency && <HistoricTag rules={["R-MULTICURRENCY"]} inactive={inactive} />}{snapshot.order_code}</span>} />
        {snapshot.product && (
          <Link href={`/catalogo/productos/${snapshot.product.code}`} className="mb-2 block text-[14px] font-semibold hover:underline">
            {snapshot.product.name}
          </Link>
        )}
        <div className="mb-3 flex flex-wrap gap-1.5 text-[12.5px]">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1">
            <CalendarClock size={13} className="text-[var(--tint)]" /> {formatDate(snapshot.service_date)}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1">
            <Users size={13} className="text-[var(--tint)]" /> {[snapshot.pax.adt && `${snapshot.pax.adt} adultos`, snapshot.pax.chd && `${snapshot.pax.chd} niños`, snapshot.pax.inf && `${snapshot.pax.inf} infantes`].filter(Boolean).join(" · ")}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Vio", value: snapshot.currency_display },
            { label: "Se cobró", value: snapshot.charge_currency },
            { label: "Cambio", value: snapshot.currency_display === snapshot.charge_currency ? "—" : snapshot.fx_rate },
          ].map((tile) => (
            <div key={tile.label} className="rounded-tile border border-line px-3 py-2 text-center">
              <span className="block text-[11.5px] text-fg-3">{tile.label}</span>
              <b className="font-mono text-[15px] font-semibold">{tile.value}</b>
            </div>
          ))}
        </div>
        {snapshot.lines && snapshot.lines.length > 0 && (
          <ul className="mt-4 flex flex-col border-t border-line-2 pt-2">
            {[...snapshot.lines, ...(snapshot.adjustments ?? [])].map((line, index) => (
              <li key={index} className="flex justify-between gap-3 py-1.5 text-[13px]">
                <span>{lineLabel(line)}</span>
                {line.amount !== undefined && <span className="font-mono">{formatMoney(line.amount, snapshot.charge_currency || currency)}</span>}
              </li>
            ))}
            {snapshot.total && (
              <li className="flex justify-between gap-3 border-t border-line-2 pt-2 text-[13.5px] font-semibold">
                <span>Total</span>
                <span className="font-mono">{formatMoney(snapshot.total, snapshot.charge_currency || currency)}</span>
              </li>
            )}
          </ul>
        )}
      </Card>
      <div className="flex flex-col gap-5">
        {snapshot.payment && (
          <Card>
            <TintCardTitle icon={Wallet} title="Plan de pago" aside={<span className="flex items-center gap-2"><HistoricTag rules={snapshot.rules_applied.filter((rule) => rule === "R-DEPOSIT" || rule === "R-PAY-LATER")} inactive={inactive} /><span className="text-[12.5px] first-letter:uppercase text-fg-3">{(snapshot.payment.mode ?? "").replace("_", " ")}</span></span>} />
            <ol className="relative ml-2 flex flex-col gap-3 border-l-2 border-line pl-4">
              {[
                { label: "Al reservar", amount: snapshot.payment.deposit, note: snapshot.payment.deposit_pct ? `${Number(snapshot.payment.deposit_pct)} % de adelanto` : null, done: true },
                { label: snapshot.payment.balance_due ? `Hasta el ${formatDate(snapshot.payment.balance_due)}` : "Saldo", amount: snapshot.payment.balance, note: "Saldo", done: false },
              ]
                .filter((step) => step.amount && Number(step.amount) > 0)
                .map((step) => (
                  <li key={step.label} className="relative text-[13px]">
                    <span className={cn("absolute -left-[23px] top-1 h-3 w-3 rounded-full border-2 border-[var(--surface)]", step.done ? "bg-ok" : "bg-[var(--tint)]")} />
                    <span className="flex items-baseline justify-between gap-3">
                      <span>
                        <b className="block font-semibold">{step.label}</b>
                        {step.note && <span className="text-[12px] text-fg-3">{step.note}</span>}
                      </span>
                      <span className="font-mono font-semibold">{formatMoney(step.amount ?? 0, snapshot.charge_currency)}</span>
                    </span>
                  </li>
                ))}
            </ol>
          </Card>
        )}
        <Card>
          <TintCardTitle icon={Plane} title="Recojo y comentarios" aside={<HistoricTag rules={[...(snapshot.pickup.point || snapshot.pickup.address ? ["R-PICKUP"] : []), ...(snapshot.comments ? ["R-COMMENTS"] : [])]} inactive={inactive} />} />
          <FieldList
            fields={[
              { label: "Punto de recojo", value: <span className="whitespace-normal">{[snapshot.pickup.point, snapshot.pickup.address].filter(Boolean).join(" · ") || "Sin indicar"}</span> },
              { label: "Vuelo", value: snapshot.pickup.flight ? `${snapshot.pickup.flight}${snapshot.pickup.arrival ? ` · llega ${formatDateTime(snapshot.pickup.arrival)}` : ""}` : "Sin indicar" },
              { label: "Comentarios", value: <span className="whitespace-normal">{snapshot.comments || "Sin comentarios"}</span> },
              { label: "Acompañantes", value: snapshot.companions.pending ? `Por completar${snapshot.companions.due ? ` hasta el ${formatDate(snapshot.companions.due)}` : ""}` : "Completos" },
            ]}
          />
        </Card>
        {(snapshot.lodging.length > 0 || snapshot.addons.length > 0) && (
          <Card>
            <TintCardTitle icon={BedDouble} title="Alojamiento y adicionales" aside={<HistoricTag rules={[...(snapshot.lodging.length > 0 ? ["R-LODGING"] : []), ...(snapshot.addons.length > 0 ? ["R-ADDONS"] : [])]} inactive={inactive} />} />
            <ul className="flex flex-col">
              {snapshot.lodging.map((item, index) => {
                const most = Math.max(...snapshot.lodging.map((row) => row.nights), 1);
                return (
                  <li key={`l${index}`} className="border-t border-line-2 py-2.5 text-[13px] first:border-t-0">
                    <span className="flex items-baseline justify-between gap-3">
                      <b className="font-semibold">{item.city}</b>
                      <span className="text-[12px] text-fg-3">{item.hotel_name ?? "Hotel por asignar"}</span>
                    </span>
                    <span className="mt-1.5 flex items-center gap-2">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <span className="block h-full rounded-full bg-[var(--tint)]" style={{ width: `${(item.nights / most) * 100}%` }} />
                      </span>
                      <span className="flex-none text-[12px] text-fg-2">
                        {item.nights} {item.nights === 1 ? "noche" : "noches"} · {item.rooms} hab.{item.room_type ? ` ${item.room_type}` : ""}
                      </span>
                    </span>
                  </li>
                );
              })}
              {snapshot.addons.map((item, index) => (
                <li key={`a${index}`} className="flex justify-between border-t border-line-2 py-2 text-[13px] first:border-t-0">
                  <span>
                    {item.name} × {item.qty}
                  </span>
                  {item.amount && <span className="font-mono">{formatMoney(item.amount, snapshot.charge_currency)}</span>}
                </li>
              ))}
            </ul>
          </Card>
        )}
        {snapshot.rules_applied.length > 0 && (
          <Card>
            <TintCardTitle icon={ScrollText} title="Reglas aplicadas" />
            <ul className="flex flex-wrap gap-1.5">
              {snapshot.rules_applied.map((rule) => {
                const meta = WEB_RULES[rule] ?? { label: rule, icon: ScrollText };
                return (
                  <li key={rule} title={rule} className="lift inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[12.5px]">
                    <meta.icon size={13} className="text-[var(--tint)]" />
                    {meta.label}
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
    </div>
  );
}

export function FeedbackSection({ feedback, messages, canEscalate = false, canReply = false, ruleOff = false }: { feedback: ReservationFeedback[]; messages: ReservationPaxMessage[]; canEscalate?: boolean; canReply?: boolean; ruleOff?: boolean }) {
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      {ruleOff && (
        <p data-testid="feedback-rule-off" className="rounded-card border border-line bg-surface-2 px-4 py-3 text-[13.5px] text-fg-2 xl:col-span-2">
          <b className="font-semibold text-fg">Los comentarios del pasajero están desactivados</b> en las reglas del motor de reservas (R-PAX-FEEDBACK). Los pasajeros ya no pueden dejar comentarios en su portal; aquí solo se ven los que dejaron antes.
        </p>
      )}
      <Card>
        <TintCardTitle
          icon={MessageSquareText}
          title="Comentarios del pasajero"
          aside={
            <span className="flex items-center gap-2">
              {feedback.length > 0 && <span className="text-[12.5px] text-fg-3">{feedback.length}</span>}
              {!canReply && (
                <InfoTip label="Quién responde">
                  Las respuestas las envía el equipo que atiende la{" "}
                  <Link href="/canales/portal-pasajero" className="font-semibold text-[var(--tint)] hover:underline">
                    bandeja del portal del pasajero
                  </Link>
                  .
                </InfoTip>
              )}
            </span>
          }
        />
        {feedback.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">Los pasajeros no han dejado comentarios en su portal.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {feedback.map((item) => (
              <li key={item.code} className={cn("lift rounded-[12px] px-3.5 py-3 text-[13px]", SOFT_TINT)}>
                <span className="mb-1 flex flex-wrap items-center gap-2">
                  <b className="font-semibold first-letter:uppercase">{item.type}</b>
                  <StatusBadge status={item.status} />
                  {item.rating !== null && (
                    <span className="inline-flex items-center gap-0.5 text-warn" aria-label={`${item.rating} de 5`}>
                      {Array.from({ length: 5 }, (_, index) => (
                        <Star key={index} size={13} className={index < (item.rating ?? 0) ? "fill-current" : "opacity-30"} />
                      ))}
                    </span>
                  )}
                </span>
                <p className="text-fg-2">{item.text}</p>
                <p className="mt-1 text-xs text-fg-3">
                  {item.passenger_name ?? "Pasajero"} · {formatDateTime(item.created_at)}
                  {item.service_name && ` · ${item.service_name}`}
                  {item.incident_code && (
                    <>
                      {" · "}
                      <Link href={`/operaciones/incidencias/${item.incident_code}`} className="font-semibold text-[var(--tint)] hover:underline">
                        {item.incident_code}
                      </Link>
                    </>
                  )}
                </p>
                {item.reply && (
                  <p className="mt-2 rounded-[10px] bg-surface px-3 py-2 text-[12.5px]">
                    <b className="font-semibold">Respuesta{item.replied_by ? ` de ${item.replied_by}` : ""}:</b> {item.reply}
                  </p>
                )}
                {((canEscalate && !item.incident_code) || canReply) && (
                  <div className="mt-2 flex flex-wrap justify-end gap-1.5">
                    {canReply && <FeedbackReplyActions feedback={item} />}
                    {canEscalate && !item.incident_code && <FeedbackIncidentAction feedback={item} />}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <TintCardTitle icon={Send} title="Mensajes enviados al pasajero" aside={messages.length ? String(messages.length) : undefined} />
        {messages.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">Todavía no se enviaron mensajes automáticos.</p>
        ) : (
          <ul className="flex flex-col">
            {messages.slice(0, 12).map((message) => (
              <li key={message.code} className="flex items-start gap-3 border-t border-line-2 py-2.5 text-[13px] first:border-t-0">
                <span className="min-w-0 flex-1">
                  <b className="block truncate font-semibold">{message.subject ?? message.origin ?? "Mensaje"}</b>
                  <span className="text-xs text-fg-3">
                    {message.channel}
                    {message.recipient ? ` · ${message.recipient}` : ""} · {formatDateTime(message.sent_at ?? message.scheduled_at ?? "")}
                  </span>
                  {message.error && <span className="block text-xs text-bad">{message.error}</span>}
                </span>
                <StatusBadge status={message.status} />
              </li>
            ))}
            {messages.length > 12 && <li className="border-t border-line-2 pt-2.5 text-[12.5px] text-fg-3">Y {messages.length - 12} mensajes anteriores.</li>}
          </ul>
        )}
      </Card>
    </div>
  );
}

const ENTITY_LABEL: Record<string, string> = { Reserva: "Reserva", "Servicio reserva": "Servicio", "Cuenta por cobrar": "Cuota" };

export function HistorySection({ events, labels }: { events: ReservationHistoryEvent[]; labels: Record<string, string> }) {
  if (events.length === 0) return <Empty icon={<History size={20} />} title="Sin eventos" description="Aún no hay movimientos registrados en la auditoría de esta reserva." />;
  return (
    <Card>
      <TintCardTitle icon={History} title="Historial" aside={`${events.length} eventos`} />
      <MiniTable head={["Fecha", "Usuario", "Registro", "Acción", "Antes", "Después"]}>
        {events.map((event) => (
          <tr key={event.id}>
            <td className="whitespace-nowrap text-xs">
              <AuditWhen at={event.occurred_at} correlation={event.correlation} />
            </td>
            <td>
              <AuditWho actor={event.actor} ip={event.ip} />
            </td>
            <td className="text-xs">
              {ENTITY_LABEL[event.entity] ?? event.entity}
              <span className="block font-mono text-fg-3">{event.entity_id}</span>
            </td>
            <td className="font-semibold">{labels[event.action] ?? statusLabel(event.action.replaceAll("_", " "))}</td>
            <td className="max-w-[200px] whitespace-normal text-xs text-fg-3">{event.before ?? "—"}</td>
            <td className="max-w-[240px] whitespace-normal text-xs">{event.after ?? "—"}</td>
          </tr>
        ))}
      </MiniTable>
    </Card>
  );
}
