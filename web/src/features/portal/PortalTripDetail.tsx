import { BedDouble, Bus, CalendarDays, Coffee, FileCheck2, FileText, Megaphone, Mountain, ReceiptText, Ticket, TriangleAlert, Users, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { DownloadButton } from "@/components/ui/DownloadButton";
import { HeroBand, HeroChip, HeroPanel, ToneScope } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { countdownLabel, PAX_TYPES, PHASES, SERVICE_STATES, type PortalTrip } from "@/lib/portal";
import { toneStyle } from "@/lib/tone";
import { AdvisorCard, EmptyLine, PortalBadge, RISE, rise, SectionCard } from "./PortalUi";

const KIND_ICONS: Record<string, LucideIcon> = { tour: Mountain, traslado: Bus, alojamiento: BedDouble, tren_entrada: Ticket, libre: Coffee };

const INVOICE_TYPES: Record<string, string> = { "01": "Factura", "03": "Boleta", "07": "Nota de crédito", "08": "Nota de débito" };

const WEEKDAY =new Intl.DateTimeFormat("es-PE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

function dayLabel(iso: string): string {
  const text = WEEKDAY.format(new Date(`${iso}T00:00:00Z`));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function Itinerary({ trip }: { trip: PortalTrip }) {
  if (trip.days.length === 0) return <EmptyLine>Tu asesor está armando el itinerario.</EmptyLine>;
  return (
    <ol className="relative flex flex-col gap-5">
      <span aria-hidden className="absolute bottom-3 left-[19px] top-3 w-0.5 bg-line" />
      {trip.days.map((day, dayIndex) => {
        const today = day.date === trip.today;
        return (
          <li key={day.date} style={rise(dayIndex)} className={cn("relative grid grid-cols-[40px_minmax(0,1fr)] gap-3", RISE)}>
            <span style={toneStyle(today ? "t2" : day.date < trip.today ? "ok" : "t1")} className="relative z-10 grid h-10 w-10 place-items-center rounded-xl bg-[var(--tint)] text-[13px] font-bold text-white shadow-[0_8px_18px_-10px_var(--tint)]">
              {day.number > 0 ? day.number : "·"}
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 pt-2 text-[14px] font-semibold">
                {day.number > 0 ? `Día ${day.number}` : "Antes del viaje"} <span className="font-normal text-fg-3">· {dayLabel(day.date)}</span>
                {today && <Badge tone="t2">Hoy</Badge>}
              </p>
              <ul className="mt-2 flex flex-col gap-2">
                {day.services.map((service) => {
                  const Icon = KIND_ICONS[service.kind] ?? CalendarDays;
                  const state = SERVICE_STATES[service.state];
                  return (
                    <li key={service.code} style={toneStyle(state.tone)} className="lift group flex items-center gap-3 rounded-tile border border-line bg-surface px-3.5 py-3">
                      <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-[color-mix(in_srgb,var(--tint)_14%,transparent)] text-[var(--tint)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                        <Icon size={17} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <b className="block text-[13.5px] font-semibold leading-snug">{service.name}</b>
                        <span className="text-[12px] text-fg-3">
                          {service.time ? `${service.time} · ` : ""}
                          {service.pax} {service.pax === 1 ? "persona" : "personas"}
                          {service.confirmation ? ` · Código ${service.confirmation}` : ""}
                        </span>
                      </span>
                      <span className="flex flex-none flex-col items-end gap-1">
                        <Badge tone={state.tone}>{state.label}</Badge>
                        {service.state === "proximo" && <PortalBadge status={service.status} scope="service" />}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function Billing({ billing }: { billing: NonNullable<PortalTrip["billing"]> }) {
  const pct = billing.amount ? Math.round((billing.paid / billing.amount) * 100) : 0;
  return (
    <SectionCard icon={Wallet} title="Estado de pago">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[12.5px] text-fg-3">Pagado</p>
          <p className="text-[22px] font-bold tracking-tight">{formatMoney(billing.paid, billing.currency)}</p>
        </div>
        <p className="text-right text-[12.5px] text-fg-3">
          de {formatMoney(billing.amount, billing.currency)}
          <br />
          <b className={cn("text-[13px]", billing.balance > 0 ? "text-warn" : "text-ok")}>{billing.balance > 0 ? `Saldo ${formatMoney(billing.balance, billing.currency)}` : "Pagado por completo"}</b>
        </p>
      </div>
      <span className="mt-3 block h-2 w-full overflow-hidden rounded-full bg-surface-2" title={`${pct} % pagado`}>
        <span className="block h-full origin-left rounded-full bg-ok motion-safe:animate-[fill-x_800ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ width: `${Math.max(3, pct)}%` }} />
      </span>
      <ul className="mt-4 flex flex-col gap-2">
        {billing.installments.map((row) => (
          <li key={row.code} className="flex items-center justify-between gap-3 rounded-tile border border-line px-3 py-2.5 transition hover:border-fg-3/40">
            <span className="min-w-0">
              <b className="block truncate text-[13px] font-semibold">{row.concept}</b>
              <span className={cn("text-[12px]", row.overdue ? "font-semibold text-bad" : "text-fg-3")}>Vence {formatDate(row.due_date)}</span>
            </span>
            <span className="flex flex-none flex-col items-end gap-1">
              <b className="text-[13px]">{formatMoney(row.balance > 0 ? row.balance : row.amount, row.currency)}</b>
              <PortalBadge status={row.overdue ? "vencida" : row.status} />
            </span>
          </li>
        ))}
      </ul>
      {billing.balance > 0 && (
        <Link href="/portal/pagos" className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-control bg-brand text-[13.5px] font-semibold text-brand-fg transition hover:brightness-110">
          <Wallet size={15} /> Reportar un pago
        </Link>
      )}
    </SectionCard>
  );
}

export function PortalTripDetail({ trip, passenger, extra }: { trip: PortalTrip; passenger: boolean; extra?: ReactNode }) {
  const phase = PHASES[trip.phase];
  const pct = trip.progress.services ? Math.round((trip.progress.confirmed / trip.progress.services) * 100) : 0;
  const missing = trip.passengers.filter((row) => row.missing).length;

  return (
    <div className="flex flex-col gap-5">
      {!passenger && (
        <Link href="/portal/viajes" className="w-fit text-[12.5px] font-semibold text-fg-3 transition hover:text-t1">
          ← Mis viajes
        </Link>
      )}
      <ToneScope tone={phase.tone === "mute" ? "t3" : phase.tone}>
        <HeroBand className="mb-0">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-white/75">{phase.label}</p>
              <h1 className="mt-1 text-[24px] font-bold leading-tight tracking-tight sm:text-[30px]">{trip.title}</h1>
              <div className="mt-3 flex flex-wrap gap-2">
                <HeroChip icon={<CalendarDays size={14} />}>
                  {formatDate(trip.from)} – {formatDate(trip.to)}
                </HeroChip>
                <HeroChip icon={<Users size={14} />}>
                  {trip.passengers.length} {trip.passengers.length === 1 ? "pasajero" : "pasajeros"}
                </HeroChip>
                {trip.total !== null && <HeroChip icon={<ReceiptText size={14} />}>{formatMoney(trip.total, trip.currency)}</HeroChip>}
              </div>
            </div>
            <HeroPanel solid>
              <p className="text-[12.5px] font-semibold text-fg-3">{trip.phase === "proximo" ? countdownLabel(trip.days_left) : "Avance de servicios"}</p>
              <p className="mt-1 text-[34px] font-bold leading-none tracking-tight text-[var(--tint)]">{pct} %</p>
              <p className="mt-1 text-[12.5px] text-fg-2">
                {trip.progress.confirmed} de {trip.progress.services} servicios confirmados
              </p>
              <span className="mt-3 block h-2 w-full overflow-hidden rounded-full bg-surface-2">
                <span className="block h-full origin-left rounded-full bg-[var(--tint)] motion-safe:animate-[fill-x_900ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ width: `${Math.max(4, pct)}%` }} />
              </span>
              {trip.status !== "cancelada" && <DownloadButton href={`/portal/viajes/${trip.code}/itinerario`} label="Itinerario PDF" size="sm" className="mt-3" />}
            </HeroPanel>
          </div>
        </HeroBand>
      </ToneScope>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-5">
          {trip.notices.length > 0 && (
            <SectionCard icon={Megaphone} title="Avisos de tu viaje" aside={trip.notices.length}>
              <ul className="flex flex-col gap-2">
                {trip.notices.map((notice, index) => (
                  <li key={notice.code} style={rise(index)} className={cn("rounded-tile border border-line bg-surface px-3.5 py-3", RISE)}>
                    {notice.subject && <b className="block text-[13.5px] font-semibold">{notice.subject}</b>}
                    <p className="whitespace-pre-line text-[13px] text-fg-2">{notice.body}</p>
                    {notice.sent_at && <span className="mt-1 block text-[11.5px] text-fg-3">{formatDateTime(notice.sent_at)}</span>}
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
          <SectionCard icon={CalendarDays} title="Itinerario día a día" aside={`${trip.days.length} ${trip.days.length === 1 ? "día" : "días"}`}>
            <Itinerary trip={trip} />
          </SectionCard>
          {extra}
          <SectionCard icon={Users} title="Pasajeros" aside={trip.passengers.length}>
            {missing > 0 && (
              <p style={toneStyle("warn")} className="mb-3 flex items-center gap-2 rounded-tile bg-[color-mix(in_srgb,var(--tint)_10%,var(--surface))] px-3 py-2 text-[12.5px] font-medium text-[var(--tint)]">
                <TriangleAlert size={15} /> Faltan datos de {missing} {missing === 1 ? "pasajero" : "pasajeros"}.{" "}
                <Link href={`/portal/viajeros?trip=${trip.code}`} className="font-semibold underline">
                  Completarlos
                </Link>
              </p>
            )}
            <ul className="grid gap-2 sm:grid-cols-2">
              {trip.passengers.map((row, index) => (
                <li key={row.seq} style={rise(index)} className={cn("lift flex items-center gap-3 rounded-tile border border-line bg-surface px-3 py-2.5", RISE)}>
                  <span className="grid h-8 w-8 flex-none place-items-center rounded-[9px] bg-surface-2 text-[12px] font-bold text-fg-2">{row.seq}</span>
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[13px] font-semibold">{row.name}</b>
                    <span className="text-[12px] text-fg-3">
                      {PAX_TYPES[row.type] ?? row.type}
                      {row.nationality ? ` · ${row.nationality}` : ""}
                      {row.document ? ` · ${row.document}` : ""}
                    </span>
                  </span>
                  {row.lead ? <Badge tone="t1">Titular</Badge> : row.missing ? <Badge tone="warn">Faltan datos</Badge> : null}
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
        <div className="flex flex-col gap-5">
          {trip.billing && <Billing billing={trip.billing} />}
          <SectionCard icon={FileCheck2} title="Documentos" aside={trip.vouchers.length + trip.invoices.length}>
            {trip.vouchers.length + trip.invoices.length === 0 ? (
              <EmptyLine>Los vouchers aparecen cuando se confirma cada servicio.</EmptyLine>
            ) : (
              <ul className="flex flex-col gap-2">
                {trip.vouchers.map((voucher) => (
                  <li key={voucher.code} className="lift flex items-center gap-3 rounded-tile border border-line bg-surface px-3 py-2.5">
                    <Ticket size={16} className="flex-none text-t4" />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[13px] font-semibold">{voucher.label}</b>
                      <span className="text-[12px] text-fg-3">
                        Voucher {voucher.code} · {formatDate(voucher.date)}
                        {voucher.version > 1 ? ` · versión ${voucher.version}` : ""}
                      </span>
                    </span>
                    <PortalBadge status={voucher.status} />
                  </li>
                ))}
                {trip.invoices.map((invoice) => (
                  <li key={invoice.number} className="lift flex items-center gap-3 rounded-tile border border-line bg-surface px-3 py-2.5">
                    <FileText size={16} className="flex-none text-t1" />
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[13px] font-semibold">
                        {INVOICE_TYPES[invoice.type] ?? "Comprobante"} {invoice.number}
                      </b>
                      <span className="text-[12px] text-fg-3">
                        {formatDate(invoice.date)} · {formatMoney(invoice.total, invoice.currency)}
                      </span>
                    </span>
                    <PortalBadge status={invoice.status} />
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
          <AdvisorCard advisor={trip.advisor} />
        </div>
      </div>
    </div>
  );
}
