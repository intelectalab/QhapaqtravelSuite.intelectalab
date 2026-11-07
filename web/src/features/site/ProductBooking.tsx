"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Loader2, MessageSquareText, ShoppingBag, Tag, TicketPercent } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { addToCart, loadMonth, quoteProduct } from "@/app/(sitio)/sitio/[agencia]/actions";
import { cn } from "@/lib/cn";
import { capitalize, formatDate, formatMoney, monthName } from "@/lib/format";
import { listingQuery, type CalendarDay, type CalendarMonth, type ProductDetail, type Quote } from "@/lib/site";
import { Stepper } from "./SearchBar";
import { useSite } from "./SiteContext";

interface Pax {
  adults: number;
  children: number;
  infants: number;
}

interface BookingValue {
  slug: string;
  product: ProductDetail["product"];
  date: string | null;
  setDate: (date: string | null) => void;
  pax: Pax;
  setPax: (pax: Pax) => void;
  days: Map<string, CalendarDay>;
  months: CalendarMonth[];
  setMonths: (months: CalendarMonth[]) => void;
}

const BookingContext = createContext<BookingValue | null>(null);

function useBooking(): BookingValue {
  const value = useContext(BookingContext);
  if (!value) throw new Error("BookingProvider requerido");
  return value;
}

const LEVEL_RING: Record<string, string> = {
  alta: "before:bg-t3",
  media: "before:bg-t1",
  baja: "before:bg-t4",
  especial: "before:bg-t2",
};

function compactMoney(amount: number, currency: string | null): string {
  const symbol = currency === "USD" ? "US$" : "S/";
  return `${symbol}${amount >= 1000 ? `${(amount / 1000).toFixed(1)}k` : Math.round(amount)}`;
}

function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, m - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function BookingProvider({ detail, initialDate, children }: { detail: ProductDetail; initialDate?: string; children: ReactNode }) {
  const product = detail.product;
  const [months, setMonths] = useState<CalendarMonth[]>(detail.calendar);
  const days = useMemo(() => new Map(months.flatMap((month) => month.days.map((day) => [day.date, day] as const))), [months]);
  const initial = initialDate && days.get(initialDate)?.sellable ? initialDate : null;
  const [date, setDate] = useState<string | null>(initial);
  const [pax, setPax] = useState<Pax>({ adults: Math.max(1, Math.min(2, product.group.max)), children: 0, infants: 0 });

  return <BookingContext.Provider value={{ slug: product.slug, product, date, setDate, pax, setPax, days, months, setMonths }}>{children}</BookingContext.Provider>;
}

export function AvailabilityCalendar() {
  const { agencia, t } = useSite();
  const { slug, date, setDate, pax, months, setMonths } = useBooking();
  const [index, setIndex] = useState(0);
  const [loading, startLoading] = useTransition();
  const seats = pax.adults + pax.children;
  const lastSeats = useRef(seats);

  useEffect(() => {
    if (lastSeats.current === seats) return;
    lastSeats.current = seats;
    startLoading(async () => {
      const loaded = await Promise.all(months.map((month) => loadMonth(agencia, slug, month.month, seats)));
      setMonths(loaded.map((month, i) => month ?? months[i]));
    });
  }, [seats, agencia, slug, months, setMonths]);

  const visible = months.slice(index, index + 2);
  const go = (delta: number) => {
    const target = index + delta;
    if (target < 0) return;
    if (target + 1 < months.length) {
      setIndex(target);
      return;
    }
    startLoading(async () => {
      const next = await loadMonth(agencia, slug, shiftMonth(months[months.length - 1].month, 1), seats);
      if (next) {
        setMonths([...months, next]);
        setIndex(target);
      }
    });
  };

  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-[13px] text-fg-2">
          {t.booking.pricePerAdult} <b className="text-fg">{t.booking.travelers(seats)}</b>
        </p>
        <div className="flex items-center gap-1">
          {loading && <Loader2 size={16} className="animate-spin text-fg-3" />}
          <button type="button" onClick={() => go(-1)} disabled={index === 0 || loading} aria-label={t.booking.prevMonth} className="grid h-9 w-9 place-items-center rounded-xl border border-line text-fg-2 transition hover:border-accent hover:text-accent disabled:opacity-40">
            <ChevronLeft size={17} />
          </button>
          <button type="button" onClick={() => go(1)} disabled={loading || index >= 10} aria-label={t.booking.nextMonth} className="grid h-9 w-9 place-items-center rounded-xl border border-line text-fg-2 transition hover:border-accent hover:text-accent disabled:opacity-40">
            <ChevronRight size={17} />
          </button>
        </div>
      </div>
      <div className={cn("grid gap-6 transition-opacity md:grid-cols-2", loading && "opacity-60")}>
        {visible.map((month) => (
          <MonthGrid key={month.month} month={month} selected={date} onSelect={setDate} />
        ))}
      </div>
      <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-4 text-[11.5px] text-fg-3">
        {(["baja", "media", "alta", "especial"] as const).map((level) => (
          <li key={level} className={cn("relative inline-flex items-center pl-3.5 before:absolute before:left-0 before:top-1/2 before:h-2 before:w-2 before:-translate-y-1/2 before:rounded-full", LEVEL_RING[level])}>
            {t.seasons[level]}
          </li>
        ))}
        <li className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-warn" />
          {t.booking.lastSpots}
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="h-2 w-4 rounded-full bg-surface-2" />
          {t.booking.unavailable}
        </li>
      </ul>
    </div>
  );
}

function MonthGrid({ month, selected, onSelect }: { month: CalendarMonth; selected: string | null; onSelect: (date: string) => void }) {
  const first = new Date(`${month.month}-01T12:00:00`);
  const { t, dateLocale } = useSite();
  const offset = (first.getDay() + 6) % 7;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <b className="text-[14.5px] font-semibold text-fg">
          {capitalize(monthName(month.month, dateLocale))} {month.month.slice(0, 4)}
        </b>
        {month.min !== null && <span className="text-[11.5px] text-fg-3">{t.booking.monthFrom(formatMoney(month.min, month.currency ?? "PEN"))}</span>}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10.5px] font-semibold text-fg-3">
        {t.booking.weekdays.map((day, i) => (
          <span key={`${day}-${i}`} className="py-1">
            {day}
          </span>
        ))}
        {Array.from({ length: offset }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {month.days.map((day) => {
          const active = selected === day.date;
          const level = day.season?.level ?? "media";
          return (
            <button
              key={day.date}
              type="button"
              disabled={!day.sellable}
              onClick={() => onSelect(day.date)}
              title={day.sellable ? `${formatDate(day.date, "long", dateLocale)} · ${day.season?.name ?? ""}${day.spots !== null ? t.booking.daySpots(day.spots) : ""}` : `${day.label}${day.note ? ` · ${day.note}` : ""}`}
              className={cn(
                "relative flex h-[50px] flex-col items-center justify-center rounded-xl border text-[12.5px] transition",
                "before:absolute before:left-1/2 before:top-1 before:h-1 before:w-1 before:-translate-x-1/2 before:rounded-full",
                day.sellable ? cn("border-line bg-surface hover:-translate-y-0.5 hover:border-accent hover:shadow-[0_8px_16px_-12px_var(--accent)]", LEVEL_RING[level]) : "cursor-not-allowed border-transparent bg-surface-2/60 text-fg-3/60 line-through decoration-fg-3/30",
                active && "border-accent bg-accent text-white hover:border-accent",
              )}
            >
              <b className="font-semibold leading-none">{Number(day.date.slice(8))}</b>
              {day.sellable && day.price !== null && <span className={cn("mt-0.5 text-[9.5px] font-medium leading-none tabular-nums", active ? "text-white/85" : "text-fg-3")}>{compactMoney(day.price, day.currency)}</span>}
              {day.sellable && day.status === "pocos" && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-warn" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BookingPanel({ promoHint }: { promoHint?: string | null }) {
  const { agencia, href, t, dateLocale } = useSite();
  const router = useRouter();
  const { slug, product, date, pax, setPax, days } = useBooking();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [promo, setPromo] = useState("");
  const [appliedPromo, setAppliedPromo] = useState("");
  const [quoting, startQuote] = useTransition();
  const [adding, startAdding] = useTransition();
  const day = date ? days.get(date) : undefined;
  const max = product.group.max;
  const seats = pax.adults + pax.children;

  useEffect(() => {
    if (!date) return;
    startQuote(async () => {
      const result = await quoteProduct(agencia, slug, { date, ...pax, promo: appliedPromo || undefined });
      setQuote(result.quote);
      setError(result.error);
    });
  }, [agencia, slug, date, pax, appliedPromo]);

  const reserve = () => {
    if (!date) return;
    startAdding(async () => {
      const result = await addToCart(agencia, { product: slug, date, ...pax, promo: appliedPromo || undefined });
      if (result.ok) router.push(href("/carrito"));
      else setError(result.message);
    });
  };

  const tailorQuery = listingQuery({ destino: product.destination.slug ?? undefined, fecha: date ?? undefined, viajeros: String(seats) });
  const tailorHref = href(`/viajes-a-medida${tailorQuery}${tailorQuery ? "&" : "?"}producto=${slug}`);
  const current = date && quote?.date === date ? quote : null;

  return (
    <div id="reservar" className="rounded-card border border-line bg-surface p-5 shadow-[0_24px_50px_-30px_rgb(14_17_32/0.45)]">
      <div className="flex items-baseline justify-between gap-2">
        <span>
          <span className="block text-[11.5px] font-medium text-fg-3">{day?.sellable ? t.booking.dayPrice : t.common.from}</span>
          <b className="text-[26px] font-bold tracking-tight text-fg">{day?.sellable && day.price !== null ? formatMoney(day.price, day.currency ?? "PEN") : product.from ? formatMoney(product.from.amount, product.from.currency) : "—"}</b>
        </span>
        {day?.season && <span className="rounded-full bg-surface-2 px-2.5 py-1 text-[11.5px] font-semibold text-fg-2">{t.seasons[day.season.level]}</span>}
      </div>

      <a href="#calendario" className="mt-4 flex h-12 items-center gap-3 rounded-control border border-line px-3.5 transition hover:border-accent">
        <CalendarDays size={17} className="text-brand" />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold text-fg-3">{t.booking.date}</span>
          <span className={cn("block truncate text-[14px]", date ? "font-semibold text-fg" : "text-fg-3")}>{date ? capitalize(formatDate(date, "long", dateLocale)) : t.booking.pickDay}</span>
        </span>
        {day?.time && <span className="text-[12px] text-fg-3">{day.time} h</span>}
      </a>

      <div className="mt-3 divide-y divide-line rounded-control border border-line">
        <PaxRow label={t.booking.adults} hint={t.booking.adultsHint} value={pax.adults} min={1} max={Math.max(1, max - pax.children)} onChange={(adults) => setPax({ ...pax, adults, infants: Math.min(pax.infants, adults) })} />
        {product.ages.children && <PaxRow label={t.booking.children} hint={t.booking.childrenHint(Math.max(2, product.ages.min))} value={pax.children} min={0} max={Math.max(0, max - pax.adults)} onChange={(children) => setPax({ ...pax, children })} />}
        {product.ages.infants && <PaxRow label={t.booking.infants} hint={t.booking.infantsHint} value={pax.infants} min={0} max={pax.adults} onChange={(infants) => setPax({ ...pax, infants })} />}
      </div>
      <p className="mt-2 text-[11.5px] text-fg-3">
        {t.booking.group(product.group.min, product.group.max)}{product.ages.min > 0 ? t.booking.minAge(product.ages.min) : ""}.
      </p>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setAppliedPromo(promo.trim().toUpperCase());
        }}
      >
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-control border border-line px-3 focus-within:border-accent">
          <TicketPercent size={15} className="text-fg-3" />
          <span className="sr-only">{t.booking.promo}</span>
          <input value={promo} onChange={(event) => setPromo(event.target.value)} placeholder={promoHint ? t.booking.promoExample(promoHint) : t.booking.promo} className="h-full min-w-0 flex-1 bg-transparent text-[13px] uppercase outline-none placeholder:normal-case placeholder:text-fg-3" />
        </label>
        <button type="submit" className="h-10 rounded-control bg-surface-2 px-3 text-[12.5px] font-semibold text-fg-2 transition hover:bg-accent hover:text-white">
          {t.common.apply}
        </button>
      </form>

      <div className="mt-4 min-h-[76px]">
        {!date && <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[13px] text-fg-2">{t.booking.pickDate}</p>}
        {date && quoting && !current && (
          <p className="flex items-center gap-2 text-[13px] text-fg-3">
            <Loader2 size={15} className="animate-spin" />
            {t.booking.calculating}
          </p>
        )}
        {date && error && <p className="rounded-xl bg-[color-mix(in_srgb,var(--bad)_8%,transparent)] px-3.5 py-3 text-[13px] text-bad">{error}</p>}
        {current && !error && (
          <dl className={cn("grid gap-1.5 text-[13px] transition-opacity", quoting && "opacity-60")}>
            {current.lines.map((line) => (
              <div key={line.key} className="flex justify-between gap-3 text-fg-2">
                <dt>
                  {line.label}
                  {Number(line.unit) > 0 && line.qty > 1 && <span className="text-fg-3"> × {formatMoney(line.unit, current.currency)}</span>}
                </dt>
                <dd className="tabular-nums">{Number(line.amount) > 0 ? formatMoney(line.amount, current.currency) : t.booking.free}</dd>
              </div>
            ))}
            {current.discount && (
              <div className="flex justify-between gap-3 text-ok">
                <dt className="inline-flex items-center gap-1.5">
                  <Tag size={13} />
                  {current.discount.label}
                </dt>
                <dd className="tabular-nums">− {formatMoney(current.discount.amount, current.currency)}</dd>
              </div>
            )}
            <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-line pt-2.5">
              <dt className="font-semibold text-fg">{t.common.total}</dt>
              <dd className="text-right">
                {current.list_total !== null && <s className="mr-2 text-[12px] text-fg-3">{formatMoney(current.list_total, current.currency)}</s>}
                <b className="text-[20px] font-bold tabular-nums text-fg">{formatMoney(current.total, current.currency)}</b>
              </dd>
            </div>
            {appliedPromo && !current.discount && <p className="text-[12px] text-warn">{t.booking.promoInvalid(appliedPromo)}</p>}
          </dl>
        )}
      </div>

      <button type="button" onClick={reserve} disabled={!current || Boolean(error) || adding} className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-control bg-brand text-[15px] font-semibold text-brand-fg shadow-[0_10px_24px_-12px_var(--brand)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:pointer-events-none disabled:opacity-50">
        {adding ? <Loader2 size={17} className="animate-spin" /> : <ShoppingBag size={17} />}
        {t.booking.reserve}
      </button>
      <Link href={tailorHref} className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-control border border-line text-[14px] font-semibold text-fg transition hover:bg-surface-2">
        <MessageSquareText size={16} />
        {t.common.tailor}
      </Link>
      <p className="mt-3 text-center text-[11.5px] text-fg-3">{t.booking.holdNote}</p>
    </div>
  );
}

function PaxRow({ label, hint, value, min, max, onChange }: { label: string; hint: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  const { t } = useSite();
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
      <span>
        <b className="block text-[13.5px] font-semibold text-fg">{label}</b>
        <span className="text-[11.5px] text-fg-3">{hint}</span>
      </span>
      <Stepper value={value} min={min} max={max} onChange={onChange} label={label.toLowerCase()} removeLabel={t.common.remove(label.toLowerCase())} addLabel={t.common.add(label.toLowerCase())} />
    </div>
  );
}

export function MobileBookingBar() {
  const { t, dateLocale } = useSite();
  const { product, date, days } = useBooking();
  const day = date ? days.get(date) : undefined;
  const price = day?.sellable && day.price !== null ? formatMoney(day.price, day.currency ?? "PEN") : product.from ? formatMoney(product.from.amount, product.from.currency) : null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-[640px] items-center justify-between gap-3">
        <span className="leading-tight">
          <span className="block text-[11px] text-fg-3">{day?.sellable ? formatDate(day.date, "short", dateLocale) : t.common.from}</span>
          <b className="text-[17px] font-bold text-fg">{price ?? "—"}</b>
        </span>
        <a href="#reservar" className="inline-flex h-11 items-center rounded-control bg-brand px-5 text-[14px] font-semibold text-brand-fg">
          {date ? t.booking.viewTotal : t.booking.chooseDate}
        </a>
      </div>
    </div>
  );
}
