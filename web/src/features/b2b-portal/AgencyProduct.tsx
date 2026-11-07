"use client";

import { AlertTriangle, BadgePercent, CalendarCheck2, ChevronLeft, ChevronRight, Clock, Info, Loader2, MapPin, Minus, Plus, ScrollText, Ticket, Users } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import type { PanelActionState } from "@/components/ui/PanelAction";
import { PanelAction } from "@/components/ui/PanelAction";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { createBooking, simulateBooking } from "@/app/(agencia)/agencia/actions";
import { PortalTitle, RISE, SectionCard } from "@/features/portal/PortalUi";
import { agencyStatus, AVAILABILITY_TONES, PAY_MODES, type AgencyProduct, type CalendarDay, type PayMode, type PriceQuote } from "@/lib/b2b-portal";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import { toneStyle } from "@/lib/tone";
import { CreditMeter, NetInfo } from "./AgencyUi";

const WEEKDAYS = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];
const MONTH_NAMES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const POLICY_LABELS = { cancellation: "Anulación", modification: "Cambios", no_show: "No show" } as const;
const initial: PanelActionState = { message: null, done: false };

function shiftMonth(month: string, delta: number): string {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function Stepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-semibold">{label}</span>
      <div className="flex h-10 items-center justify-between rounded-control border border-line bg-surface px-1">
        <button type="button" aria-label={`Quitar ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(value - 1)} className="grid h-8 w-8 place-items-center rounded-lg text-fg-2 transition hover:bg-surface-2 hover:text-fg disabled:opacity-40">
          <Minus size={15} />
        </button>
        <b className="text-[15px] tabular-nums">{value}</b>
        <button type="button" aria-label={`Agregar ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="grid h-8 w-8 place-items-center rounded-lg text-fg-2 transition hover:bg-surface-2 hover:text-fg disabled:opacity-40">
          <Plus size={15} />
        </button>
      </div>
    </div>
  );
}

function MonthCalendar({ days, month, selected, minMonth, onPick, hrefFor }: { days: CalendarDay[]; month: string; selected: string | null; minMonth: string; onPick: (day: CalendarDay) => void; hrefFor: (month: string) => string }) {
  const offset = (new Date(`${month}-01T12:00:00`).getDay() + 6) % 7;
  const [year, value] = month.split("-").map(Number);
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Link aria-label="Mes anterior" href={hrefFor(shiftMonth(month, -1))} scroll={false} className={cn("grid h-9 w-9 place-items-center rounded-xl border border-line text-fg-2 transition hover:-translate-x-0.5 hover:text-fg", month <= minMonth && "pointer-events-none opacity-40")}>
          <ChevronLeft size={16} />
        </Link>
        <b className="text-[15px]">
          {MONTH_NAMES[value - 1]} {year}
        </b>
        <Link aria-label="Mes siguiente" href={hrefFor(shiftMonth(month, 1))} scroll={false} className="grid h-9 w-9 place-items-center rounded-xl border border-line text-fg-2 transition hover:translate-x-0.5 hover:text-fg">
          <ChevronRight size={16} />
        </Link>
      </div>
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {WEEKDAYS.map((day) => (
          <span key={day} className="pb-1 text-[11.5px] font-semibold text-fg-3">
            {day}
          </span>
        ))}
        {Array.from({ length: offset }, (_, index) => (
          <span key={`blank-${index}`} />
        ))}
        {days.map((day, index) => {
          const tone = AVAILABILITY_TONES[day.status] ?? "mute";
          const active = selected === day.date;
          return (
            <button
              key={day.date}
              type="button"
              disabled={!day.sellable}
              onClick={() => onPick(day)}
              title={`${formatDate(day.date)} · ${day.label}${day.spots !== null ? ` · ${day.spots} cupos` : ""}${day.note ? ` · ${day.note}` : ""}`}
              style={{ ...toneStyle(tone), animationDelay: `${index * 12}ms` }}
              className={cn(
                "relative flex aspect-square min-h-11 flex-col items-center justify-center rounded-[10px] border text-[13px] font-semibold transition motion-safe:animate-[rise-in_360ms_cubic-bezier(0.22,1,0.36,1)_backwards]",
                day.sellable ? "border-[color-mix(in_srgb,var(--tint)_30%,transparent)] bg-[color-mix(in_srgb,var(--tint)_9%,var(--surface))] hover:-translate-y-0.5 hover:shadow-[0_8px_18px_-12px_var(--tint)]" : "cursor-not-allowed border-transparent bg-surface-2 text-fg-3",
                active && "border-[var(--tint)] bg-[var(--tint)] text-white",
              )}
            >
              {Number(day.date.slice(8, 10))}
              {day.sellable && day.spots !== null && <span className={cn("text-[10px] font-medium", active ? "text-white/85" : "text-[var(--tint)]")}>{day.spots}</span>}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[11.5px] text-fg-3">
        {[
          ["ok", "Disponible"],
          ["warn", "Últimos cupos"],
          ["bad", "Agotado"],
          ["mute", "Sin salida o fuera de plazo"],
        ].map(([tone, label]) => (
          <span key={label} className="flex items-center gap-1.5" style={toneStyle(tone as "ok")}>
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--tint)]" /> {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function QuoteLine({ label, value, strong = false, tone }: { label: string; value: string; strong?: boolean; tone?: "ok" | "violet" | "bad" }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 text-[13px]" style={tone ? toneStyle(tone) : undefined}>
      <span className="text-fg-2">{label}</span>
      <b className={cn(strong ? "text-[16px]" : "font-semibold", tone && "text-[var(--tint)]")}>{value}</b>
    </div>
  );
}

function BookingPanel({ data, quote }: { data: AgencyProduct; quote: PriceQuote }) {
  const modes: PayMode[] = quote.credit.allowed ? ["credito", "prepago"] : ["prepago"];
  const [mode, setMode] = useState<PayMode>(modes[0]);
  const [clientMode, setClientMode] = useState("agencia");
  const docOptions = data.doc_types.map((value) => ({ value, label: value }));
  return (
    <PanelAction
      label="Reservar"
      icon={<CalendarCheck2 size={15} />}
      variant="primary"
      formId="reserva-b2b"
      title="Confirmar reserva"
      description={`${quote.name} · ${formatDate(quote.date)} · ${quote.seats} ${quote.seats === 1 ? "pasajero" : "pasajeros"}`}
      submitLabel={mode === "credito" ? "Reservar a crédito" : "Reservar con prepago"}
      action={createBooking.bind(null, quote.product)}
      initial={initial}
      trigger={(open) => (
        <button type="button" onClick={open} className="flex h-11 w-full items-center justify-center gap-2 rounded-control bg-brand text-[14px] font-semibold text-brand-fg shadow-[0_8px_20px_-10px_var(--brand)] transition hover:-translate-y-0.5 hover:brightness-110">
          <CalendarCheck2 size={16} /> Reservar
        </button>
      )}
    >
      {(state) => (
        <>
          <input type="hidden" name="date" value={quote.date} />
          <input type="hidden" name="adults" value={quote.adults} />
          <input type="hidden" name="children" value={quote.children} />
          <div className="rounded-tile bg-surface-2 px-3.5 py-3">
            <QuoteLine label="Total neto" value={formatMoney(quote.net_total, quote.currency)} strong />
            <QuoteLine label={`Comisión ${quote.commission_pct} %`} value={formatMoney(quote.commission, quote.currency)} tone="violet" />
          </div>
          <ChoiceGroup label="Forma de pago" name="pay_mode" options={modes.map((value) => ({ value, label: PAY_MODES[value].label }))} defaultValue={modes[0]} hint={PAY_MODES[mode].hint} onChange={(value) => setMode(value as PayMode)} />
          {!quote.credit.allowed && quote.credit.reason && (
            <p style={toneStyle("warn")} className="-mt-2 flex items-start gap-2 rounded-tile bg-[color-mix(in_srgb,var(--tint)_9%,var(--surface))] px-3 py-2.5 text-[12.5px] text-fg-2">
              <AlertTriangle size={14} className="mt-0.5 flex-none text-[var(--tint)]" /> {quote.credit.reason}
            </p>
          )}
          <p className="-mt-1 text-[12.5px] text-fg-3">
            La reserva quedará como <b className="text-fg">{agencyStatus(quote.outcome[mode]).label.toLowerCase()}</b>
            {mode === "credito" && quote.availability.departure ? " y se emiten los vouchers al instante." : "."}
          </p>
          <TextField label="Tu referencia" name="agency_ref" maxLength={40} placeholder="Número de file o expediente" hint="Opcional. La verás en tus reservas y estado de cuenta." />
          <ChoiceGroup
            label="Titular de la reserva"
            name="client_mode"
            options={[
              { value: "agencia", label: "Mi agencia" },
              { value: "final", label: "Cliente final" },
            ]}
            defaultValue="agencia"
            onChange={setClientMode}
          />
          {clientMode === "final" && (
            <div className="grid gap-3 rounded-tile border border-line p-3.5 sm:grid-cols-2">
              <TextField label="Nombre completo" name="client_name" required maxLength={150} className="sm:col-span-2" />
              <SelectField label="Documento" name="client_doc_type" options={docOptions} defaultValue="DNI" />
              <TextField label="Número" name="client_doc_number" required maxLength={20} />
              <TextField label="Correo" name="client_email" type="email" required maxLength={190} />
              <TextField label="Teléfono" name="client_phone" maxLength={30} />
            </div>
          )}
          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-1.5 text-[13px] font-semibold">Pasajeros</legend>
            <p className="-mt-1 text-[12.5px] text-fg-3">Puedes nominarlos ahora o después desde la ficha de la reserva.</p>
            {Array.from({ length: quote.seats }, (_, index) => (
              <div key={index} className="grid gap-2 rounded-tile border border-line p-2.5 sm:grid-cols-[minmax(0,1.6fr)_110px_minmax(0,1fr)]">
                <TextField label={`Pasajero ${index + 1}${index >= quote.adults ? " · niño" : ""}`} name={`pax_name_${index}`} maxLength={145} placeholder="Por nominar" />
                <SelectField label="Doc." name={`pax_doc_type_${index}`} options={docOptions} defaultValue="DNI" />
                <TextField label="Número" name={`pax_doc_${index}`} maxLength={20} />
              </div>
            ))}
          </fieldset>
          <TextArea label="Indicaciones" name="notes" rows={3} maxLength={500} placeholder="Opcional: dietas, recojo, observaciones" />
          {state.message && <p className="text-[13px] font-medium text-bad">{state.message}</p>}
        </>
      )}
    </PanelAction>
  );
}

export function AgencyProductView({ data, initialDate }: { data: AgencyProduct; initialDate: string | null }) {
  const product = data.product;
  const router = useRouter();
  const pathname = usePathname();
  const startDate = initialDate ?? product.calendar.find((day) => day.sellable)?.date ?? product.next_date;
  const [date, setDate] = useState<string | null>(startDate);
  const [adults, setAdults] = useState(Math.max(1, Math.min(product.pax.max, product.seats)));
  const [children, setChildren] = useState(0);
  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const booted = useRef(false);
  const hrefFor = (month: string, pax = adults + children) => `${pathname}?mes=${month}&pax=${pax}`;

  const simulate = (nextDate: string | null, nextAdults: number, nextChildren: number) => {
    if (!nextDate || !product.bookable) return;
    startTransition(async () => {
      const result = await simulateBooking({ product: product.code, date: nextDate, adults: nextAdults, children: nextChildren });
      setQuote(result.quote);
      setMessage(result.message);
    });
  };

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    if (startDate && product.bookable) {
      simulateBooking({ product: product.code, date: startDate, adults: Math.max(1, Math.min(product.pax.max, product.seats)), children: 0 }).then((result) => {
        setQuote(result.quote);
        setMessage(result.message);
      });
    }
  }, [product.code, product.bookable, product.pax.max, product.seats, startDate]);

  const changePax = (nextAdults: number, nextChildren: number) => {
    setAdults(nextAdults);
    setChildren(nextChildren);
    simulate(date, nextAdults, nextChildren);
    router.replace(hrefFor(product.month, nextAdults + nextChildren), { scroll: false });
  };

  return (
    <>
      <PortalTitle
        back={{ href: "/agencia/catalogo", label: "Catálogo" }}
        title={product.name}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {product.destination && (
              <span className="flex items-center gap-1">
                <MapPin size={13} /> {product.destination}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock size={13} /> {product.duration}
            </span>
            <span className="flex items-center gap-1">
              <Users size={13} /> {product.pax.min} a {product.pax.max} pasajeros
            </span>
            <span className="flex items-center gap-1">
              <CalendarCheck2 size={13} /> Reserva con {product.advance_days} {product.advance_days === 1 ? "día" : "días"} de anticipación
            </span>
          </span>
        }
        actions={product.credit ? <Badge tone="ok">Admite crédito</Badge> : product.bookable ? <Badge tone="warn">Solo prepago</Badge> : <Badge tone="mute">No reservable</Badge>}
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="flex flex-col gap-5">
          <SectionCard icon={CalendarCheck2} title="Disponibilidad por fecha" aside={`${product.seats} ${product.seats === 1 ? "pasajero" : "pasajeros"}`}>
            {product.reason ? (
              <p className="rounded-tile border border-dashed border-line px-4 py-5 text-center text-[13px] text-fg-3">{product.reason}</p>
            ) : (
              <MonthCalendar
                days={product.calendar}
                month={product.month}
                selected={date}
                minMonth={data.today.slice(0, 7)}
                hrefFor={(month) => hrefFor(month)}
                onPick={(day) => {
                  setDate(day.date);
                  simulate(day.date, adults, children);
                }}
              />
            )}
          </SectionCard>

          <div className="grid gap-5 lg:grid-cols-2">
            <SectionCard icon={ScrollText} title="Qué incluye">
              <p className="text-[13.5px] leading-relaxed text-fg-2">{product.description ?? product.summary}</p>
              {product.min_age !== null && product.min_age > 0 && <p className="mt-2 text-[12.5px] text-fg-3">Edad mínima: {product.min_age} años.</p>}
              {product.conditions && <p className="mt-3 rounded-tile bg-surface-2 px-3 py-2.5 text-[12.5px] text-fg-2">{product.conditions}</p>}
              {product.restrictions && <p className="mt-2 text-[12.5px] font-medium text-warn">{product.restrictions}</p>}
            </SectionCard>
            <SectionCard icon={Info} title="Políticas">
              {Object.keys(product.policies).length === 0 ? (
                <p className="text-[13px] text-fg-3">Se aplican las condiciones generales del convenio.</p>
              ) : (
                <dl className="flex flex-col gap-2.5">
                  {(Object.keys(POLICY_LABELS) as (keyof typeof POLICY_LABELS)[]).filter((key) => product.policies[key]).map((key) => (
                    <div key={key} className="lift rounded-tile border border-line px-3 py-2.5">
                      <dt className="text-[12px] font-semibold text-fg-3">{POLICY_LABELS[key]}</dt>
                      <dd className="text-[13px] text-fg-2">{product.policies[key]}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </SectionCard>
          </div>
        </div>

        <div className={cn("flex flex-col gap-5 xl:sticky xl:top-24", RISE)}>
          <Card>
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold">
                <BadgePercent size={16} className="text-t3" /> Simular reserva <NetInfo />
              </h3>
              {pending && <Loader2 size={16} className="animate-spin text-fg-3" />}
            </div>
            {!product.bookable ? (
              <p className="text-[13px] text-fg-3">{product.reason}</p>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="rounded-tile border border-line px-3.5 py-2.5">
                  <span className="text-[12px] text-fg-3">Fecha de salida</span>
                  <b className="block text-[14.5px]">{date ? formatDate(date, "long") : "Elige un día en el calendario"}</b>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Stepper label="Adultos" value={adults} min={1} max={product.pax.max - children} onChange={(value) => changePax(value, children)} />
                  <Stepper label="Niños" value={children} min={0} max={Math.max(0, product.pax.max - adults)} onChange={(value) => changePax(adults, value)} />
                </div>
                {message && <p className="text-[13px] font-medium text-bad">{message}</p>}
                {quote && (
                  <div className={cn("flex flex-col gap-3 transition-opacity", pending && "opacity-60")}>
                    <div className="rounded-tile bg-surface-2 px-3.5 py-2">
                      <QuoteLine label={`Neto ${formatMoney(quote.net_unit, quote.currency)} × ${quote.seats}`} value={formatMoney(quote.net_total, quote.currency)} strong />
                      <QuoteLine label={`Tu comisión ${quote.commission_pct} %`} value={formatMoney(quote.commission, quote.currency)} tone="violet" />
                      {quote.pvp_total !== null && <QuoteLine label="PVP sugerido" value={formatMoney(quote.pvp_total, quote.currency)} />}
                      {quote.margin !== null && Number(quote.margin) > 0 && <QuoteLine label="Margen al PVP" value={formatMoney(quote.margin, quote.currency)} tone="ok" />}
                    </div>
                    <div style={toneStyle(AVAILABILITY_TONES[quote.availability.status] ?? "mute")} className="flex items-center gap-2 rounded-tile border border-[color-mix(in_srgb,var(--tint)_28%,transparent)] px-3 py-2 text-[12.5px]">
                      <Ticket size={14} className="text-[var(--tint)]" />
                      <span className="font-semibold text-[var(--tint)]">{quote.availability.label}</span>
                      <span className="text-fg-3">
                        {quote.availability.spots !== null ? `${quote.availability.spots} cupos` : "Sujeto a confirmación del proveedor"}
                        {quote.availability.departure ? ` · salida ${quote.availability.departure.time}` : ""}
                      </span>
                    </div>
                    {quote.credit.currency && (
                      <div className="text-[12.5px] text-fg-2">
                        {quote.credit.allowed ? (
                          <span>
                            Crédito tras reservar: <b className="text-fg">{formatMoney(quote.credit.after, quote.credit.currency)}</b>
                            {quote.credit.currency !== quote.currency && <span className="text-fg-3"> (TC {quote.fx})</span>}
                          </span>
                        ) : (
                          <span className="text-warn">{quote.credit.reason}</span>
                        )}
                      </div>
                    )}
                    {quote.errors.length > 0 ? (
                      <ul className="flex flex-col gap-1.5">
                        {quote.errors.map((error) => (
                          <li key={error} style={toneStyle("bad")} className="flex items-start gap-2 rounded-tile bg-[color-mix(in_srgb,var(--tint)_8%,var(--surface))] px-3 py-2 text-[12.5px] text-[var(--tint)]">
                            <AlertTriangle size={14} className="mt-0.5 flex-none" /> {error}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <BookingPanel key={`${quote.date}-${quote.seats}-${quote.credit.allowed}`} data={data} quote={quote} />
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>
          <Card>
            <CreditMeter credit={data.credit} compact />
          </Card>
        </div>
      </div>
    </>
  );
}
