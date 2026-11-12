"use client";

import { Ban, BadgePercent, CalendarDays, CheckCircle2, FileCheck2, Hash, Pencil, ReceiptText, Undo2, UserRound, Users, Wallet } from "lucide-react";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { DownloadButton } from "@/components/ui/DownloadButton";
import type { PanelActionState } from "@/components/ui/PanelAction";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { TintTile } from "@/components/ui/Tinted";
import { requestCancel, savePassenger, withdrawCancel } from "@/app/(agencia)/agencia/actions";
import { SERVICE_KINDS } from "@/lib/channels";
import { EmptyLine, PortalTitle, RISE, rise, SectionCard } from "@/features/portal/PortalUi";
import { agencyStatus, PAY_MODES, type AgencyPassenger, type AgencyReservation } from "@/lib/b2b-portal";
import { PAX_TYPES } from "@/lib/portal";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { toneStyle } from "@/lib/tone";
import { AgencyBadge } from "./AgencyUi";
import { InstallmentList, PaymentList } from "./AgencyPayments";

const initial: PanelActionState = { message: null, done: false };

function PassengerPanel({ code, passenger, docTypes }: { code: string; passenger: AgencyPassenger; docTypes: string[] }) {
  const placeholder = /por nominar|por completar/i.test(passenger.name);
  return (
    <PanelAction
      label="Editar"
      title={`Pasajero ${passenger.seq}`}
      description={PAX_TYPES[passenger.type] ?? passenger.type}
      formId={`pax-${passenger.seq}`}
      submitLabel="Guardar pasajero"
      action={savePassenger.bind(null, code, passenger.seq)}
      initial={initial}
      trigger={(open) => (
        <button type="button" onClick={open} aria-label={`Editar pasajero ${passenger.seq}`} className="grid h-8 w-8 flex-none place-items-center rounded-[9px] bg-[color-mix(in_srgb,var(--violet)_12%,transparent)] text-[var(--violet)] transition-transform duration-300 hover:-translate-y-0.5 hover:scale-105">
          <Pencil size={15} />
        </button>
      )}
    >
      {(state) => (
        <>
          <TextField label="Nombre completo" name="full_name" defaultValue={placeholder ? "" : passenger.name} required minLength={3} maxLength={145} />
          <div className="grid gap-3 sm:grid-cols-[140px_minmax(0,1fr)]">
            <SelectField label="Documento" name="doc_type" options={docTypes.map((value) => ({ value, label: value }))} defaultValue={passenger.doc_type ?? "DNI"} />
            <TextField label="Número" name="doc_number" defaultValue={passenger.doc_number ?? ""} maxLength={20} hint="Necesario para emitir entradas nominativas." />
          </div>
          <TextField label="Nacionalidad" name="nationality" defaultValue={passenger.nationality ?? ""} maxLength={60} />
          <TextField label="Fecha de nacimiento" name="birth_date" type="date" defaultValue={passenger.birth_date ?? ""} />
          {state.message && <p className="text-[13px] font-medium text-bad">{state.message}</p>}
        </>
      )}
    </PanelAction>
  );
}

function CancelPanel({ reservation, open }: { reservation: AgencyReservation; open: boolean }) {
  return (
    <PanelAction
      label="Solicitar anulación"
      icon={<Ban size={15} />}
      formId="anular-b2b"
      title="Solicitar anulación"
      description={`${reservation.title} · ${reservation.code}`}
      submitLabel="Enviar solicitud"
      action={requestCancel.bind(null, reservation.code)}
      initial={initial}
      defaultOpen={open}
    >
      {(state) => (
        <>
          <p className="rounded-tile bg-surface-2 px-3.5 py-3 text-[13px] text-fg-2">Tu ejecutivo revisa la solicitud y te confirma la penalidad según la política del producto. La reserva sigue vigente hasta que la aprobemos.</p>
          <SelectField label="Motivo" name="reason" placeholder="Elige el motivo" options={reservation.cancel.reasons.map((value) => ({ value, label: value }))} />
          <TextArea label="Detalle" name="detail" rows={4} minLength={5} maxLength={500} required placeholder="Cuéntanos qué pasó con el cliente o la fecha" />
          {state.message && <p className="text-[13px] font-medium text-bad">{state.message}</p>}
        </>
      )}
    </PanelAction>
  );
}

function WithdrawButton({ code }: { code: string }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <span className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setMessage((await withdrawCancel(code)).message))}
        className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-line px-3 text-[12.5px] font-semibold text-fg-2 transition hover:-translate-y-0.5 hover:text-fg disabled:opacity-50"
      >
        <Undo2 size={14} /> Retirar solicitud
      </button>
      {message && <span className="text-[12px] text-bad">{message}</span>}
    </span>
  );
}

export function AgencyReservationDetail({ reservation, created, openCancel }: { reservation: AgencyReservation; created: boolean; openCancel: boolean }) {
  const request = reservation.cancel.request;
  const missing = reservation.passengers.filter((row) => row.missing).length;
  return (
    <>
      <PortalTitle
        back={{ href: "/agencia/reservas", label: "Mis reservas" }}
        title={reservation.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1">
              <Hash size={13} /> {reservation.code}
            </span>
            <span className="flex items-center gap-1">
              <CalendarDays size={13} /> {formatDate(reservation.from)}
              {reservation.to !== reservation.from ? ` – ${formatDate(reservation.to)}` : ""}
            </span>
            {reservation.reference && <span>Ref. {reservation.reference}</span>}
          </span>
        }
        actions={
          <>
            <AgencyBadge status={reservation.status} scope="trip" />
            {reservation.pay_mode && <Badge tone={reservation.pay_mode === "credito" ? "t1" : "warn"}>{PAY_MODES[reservation.pay_mode].label}</Badge>}
            {reservation.cancel.allowed && <CancelPanel reservation={reservation} open={openCancel} />}
          </>
        }
      />

      {created && (
        <p style={toneStyle("ok")} className={cn("mb-5 flex items-center gap-2 rounded-tile border border-[color-mix(in_srgb,var(--tint)_30%,transparent)] bg-[color-mix(in_srgb,var(--tint)_9%,var(--surface))] px-4 py-3 text-[13.5px] font-medium text-[var(--tint)]", RISE)}>
          <CheckCircle2 size={16} /> Reserva creada como {agencyStatus(reservation.status).label.toLowerCase()}.
          {reservation.vouchers.length > 0 ? " Los vouchers ya están emitidos." : " Te avisaremos cuando se confirme."}
        </p>
      )}

      {request && (
        <div style={toneStyle(request.status === "pendiente" ? "warn" : request.status === "aprobada" ? "bad" : "mute")} className={cn("mb-5 flex flex-wrap items-center justify-between gap-3 rounded-tile border border-[color-mix(in_srgb,var(--tint)_30%,transparent)] bg-[color-mix(in_srgb,var(--tint)_8%,var(--surface))] px-4 py-3", RISE)}>
          <span className="min-w-0 text-[13px]">
            <b className="block text-[var(--tint)]">Solicitud de anulación · {agencyStatus(request.status === "pendiente" ? "pendiente" : request.status).label}</b>
            <span className="text-fg-2">
              {request.reason.replace(/^Agencia [^·]+· /, "")} · {formatDateTime(request.requested_at)}
            </span>
            {request.note && <span className="block text-fg-3">{request.note}</span>}
          </span>
          {request.status === "pendiente" && <WithdrawButton code={reservation.code} />}
        </div>
      )}

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TintTile icon={ReceiptText} tone="t3" label="Total neto" value={formatMoney(reservation.total, reservation.currency)} note={reservation.pvp ? `PVP sugerido ${formatMoney(reservation.pvp, reservation.currency)}` : reservation.price_list ?? "Tarifa de convenio"} />
        <TintTile icon={CheckCircle2} tone="ok" label="Pagado" value={formatMoney(reservation.billing.paid, reservation.billing.currency)} note={`de ${formatMoney(reservation.billing.amount, reservation.billing.currency)}`} />
        <TintTile icon={Wallet} tone={reservation.billing.balance > 0 ? "t2" : "ok"} label="Saldo" value={reservation.billing.balance > 0 ? formatMoney(reservation.billing.balance, reservation.billing.currency) : "Al día"} note={reservation.billing.installments[0] ? `Vence ${formatDate(reservation.billing.installments[0].due_date)}` : "Sin cuotas"} />
        <TintTile icon={BadgePercent} tone="violet" label="Tu comisión" value={reservation.commission ? formatMoney(reservation.commission.amount, reservation.commission.currency) : "—"} note={reservation.commission ? `${reservation.commission.pct} % · ${agencyStatus(reservation.commission.status).label.toLowerCase()}` : "Sin comisión"} />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex flex-col gap-5">
          <SectionCard icon={CalendarDays} title="Itinerario" aside={`${reservation.days.length} ${reservation.days.length === 1 ? "día" : "días"}`}>
            {reservation.days.length === 0 ? (
              <EmptyLine>Los servicios aparecerán al confirmar la reserva.</EmptyLine>
            ) : (
              <ol className="flex flex-col gap-4">
                {reservation.days.map((day, dayIndex) => (
                  <li key={day.date} style={rise(dayIndex)} className={cn("relative pl-12", RISE)}>
                    <span className="absolute left-0 top-0 grid h-9 w-9 place-items-center rounded-full bg-[color-mix(in_srgb,var(--t3)_14%,var(--surface))] text-[13px] font-bold text-t3">{day.number}</span>
                    <b className="block text-[13.5px]">{formatDate(day.date, "long")}</b>
                    <ul className="mt-2 flex flex-col gap-1.5">
                      {day.services.map((service) => (
                        <li key={service.code} className="lift flex items-center justify-between gap-3 rounded-tile border border-line bg-surface px-3 py-2.5">
                          <span className="min-w-0">
                            <b className="block truncate text-[13px] font-semibold">{service.name}</b>
                            <span className="text-[12px] text-fg-3">
                              {SERVICE_KINDS[service.kind] ?? service.kind}
                              {service.time ? ` · ${service.time}` : ""} · {service.pax} pax
                              {service.confirmation ? ` · Conf. ${service.confirmation}` : ""}
                            </span>
                          </span>
                          <AgencyBadge status={service.status} scope="service" />
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
          </SectionCard>

          <div id="pasajeros" className="scroll-mt-24">
            <SectionCard icon={Users} title="Pasajeros" aside={missing > 0 ? `${missing} por nominar` : `${reservation.passengers.length}`}>
              <ul className="flex flex-col gap-2">
                {reservation.passengers.map((row, index) => (
                  <li key={row.seq} style={{ ...toneStyle(row.missing ? "info" : "ok"), ...rise(index) }} className={cn("lift flex items-center gap-3 rounded-tile border border-line bg-surface px-3.5 py-2.5", RISE)}>
                    <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[color-mix(in_srgb,var(--tint)_14%,var(--surface))] text-[var(--tint)]">
                      <UserRound size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <b className={cn("block truncate text-[13.5px] font-semibold", row.missing && "text-fg-2")}>{row.name}</b>
                      <span className="text-[12px] text-fg-3">
                        {PAX_TYPES[row.type] ?? row.type}
                        {row.lead ? " · Titular" : ""}
                        {row.doc_number ? ` · ${row.doc_type ?? ""} ${row.doc_number}` : " · Falta documento"}
                        {row.nationality ? ` · ${row.nationality}` : ""}
                      </span>
                    </span>
                    {reservation.editable && <PassengerPanel code={reservation.code} passenger={row} docTypes={reservation.doc_types} />}
                  </li>
                ))}
              </ul>
            </SectionCard>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <SectionCard icon={Wallet} title="Estado de pago">
            <InstallmentList rows={reservation.billing.installments} methods={reservation.methods} today={reservation.today} />
            {reservation.billing.payments.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-[12.5px] font-semibold text-fg-3">Pagos</p>
                <PaymentList rows={reservation.billing.payments} />
              </div>
            )}
          </SectionCard>
          <SectionCard icon={FileCheck2} title="Vouchers" aside={reservation.vouchers.length || undefined}>
            {reservation.vouchers.length === 0 ? (
              <EmptyLine>{reservation.pay_mode === "prepago" ? "Se emiten tras confirmar el prepago." : "Se emiten cuando el servicio queda confirmado."}</EmptyLine>
            ) : (
              <ul className="flex flex-col gap-2">
                {reservation.vouchers.map((row, index) => (
                  <li key={row.code} style={rise(index)} className={cn("lift flex items-center justify-between gap-3 rounded-tile border border-line bg-surface px-3.5 py-2.5", RISE)}>
                    <span className="min-w-0">
                      <b className="block truncate text-[13px] font-semibold">{row.label}</b>
                      <span className="text-[12px] text-fg-3">
                        {row.code} · v{row.version} · {formatDate(row.date)} · {row.pax} pax
                      </span>
                    </span>
                    <span className="flex flex-none items-center gap-2">
                      <AgencyBadge status={row.status} />
                      <DownloadButton href={`/agencia/vouchers/${row.code}/pdf`} label={`Descargar voucher ${row.code}`} size="sm" variant="ghost" iconOnly />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
          <SectionCard icon={UserRound} title="Titular">
            <dl className="grid gap-2 text-[13px]">
              <div className="flex justify-between gap-3">
                <dt className="text-fg-3">Cliente</dt>
                <dd className="text-right font-semibold">{reservation.client ? (reservation.client.own ? "Tu agencia" : reservation.client.name) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-fg-3">Lista de precios</dt>
                <dd className="text-right">{reservation.price_list ?? "Convenio"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-fg-3">Reservada</dt>
                <dd className="text-right">{formatDateTime(reservation.created_at)}</dd>
              </div>
            </dl>
          </SectionCard>
        </div>
      </div>
    </>
  );
}
