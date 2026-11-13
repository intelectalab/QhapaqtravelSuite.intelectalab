"use client";

import { CheckCircle2, Minus, Plus, ShieldCheck, Ticket } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { bookTour, type BookingResult } from "@/app/(vitrina)/vitrina/actions";
import { formatDate, formatMoney } from "@/lib/format";
import { RL_LANGUAGES, rlPath } from "@/lib/rutas-libres";
import type { ShowcaseListing } from "@/lib/vitrina";
import { Price } from "./Cards";

const initial: BookingResult = { ok: false, message: null };

interface BookingFormProps {
  listing: Pick<ShowcaseListing, "slug" | "title" | "model" | "price" | "currency" | "capacity" | "start_times" | "languages" | "meeting_point">;
  agency: string;
  days: { value: string; weekday: string; day: string }[];
  base: string;
}

export function BookingForm({ listing, agency, days, base }: BookingFormProps) {
  const [state, action, pending] = useActionState(bookTour, initial);
  const [date, setDate] = useState(days[0]?.value ?? "");
  const [time, setTime] = useState(listing.start_times[0] ?? "");
  const [language, setLanguage] = useState(listing.languages[0] ?? "es");
  const [pax, setPax] = useState(2);
  const [marketing, setMarketing] = useState(false);
  const max = Math.min(30, listing.capacity);
  const paid = listing.model === "pago";

  if (state.ok && state.booking) {
    const booking = state.booking;
    return (
      <div className="flex flex-col gap-4" role="status">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--rl-emerald-soft)] text-[var(--rl-emerald)]"><CheckCircle2 size={26} /></span>
        <h2 className="rl-h3">Reserva {booking.code} confirmada</h2>
        <ul className="flex flex-col gap-1.5 text-[14px]">
          <li><b>{formatDate(booking.date, "long")}</b> a las <b>{booking.time}</b></li>
          <li>{booking.pax} {booking.pax === 1 ? "persona" : "personas"} · {RL_LANGUAGES[language] ?? language}</li>
          <li className="rl-muted">Punto de encuentro: {listing.meeting_point}</li>
          {booking.amount && <li>Total referencial: <b className="rl-price">{formatMoney(booking.amount, booking.currency)}</b>, se paga a la agencia.</li>}
        </ul>
        <p className="rl-muted text-[13px]">Le enviaremos la confirmación por correo. Si no puede asistir, libere su cupo:</p>
        <Link href={rlPath(base, `/cancelar/${booking.cancel_token}`)} className="rl-btn self-start">Cancelar esta reserva</Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="slug" value={listing.slug} />
      <input type="hidden" name="date" value={date} />
      <input type="hidden" name="time" value={time} />
      <input type="hidden" name="language" value={language} />
      <input type="hidden" name="pax" value={pax} />
      <input type="hidden" name="marketing_consent" value={marketing ? "1" : "0"} />
      <Price listing={listing} size="lg" />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-[13px] font-semibold">Fecha</legend>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {days.map((day) => (
            <button key={day.value} type="button" aria-pressed={date === day.value} onClick={() => setDate(day.value)} className="rl-chip rl-day text-center">
              <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">{day.weekday}</span>
              <span className="text-[17px] font-extrabold">{day.day}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold">Horario</legend>
        <div className="flex flex-wrap gap-2">
          {listing.start_times.map((value) => (
            <button key={value} type="button" aria-pressed={time === value} onClick={() => setTime(value)} className="rl-chip font-mono">{value}</button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold">Personas</legend>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setPax((value) => Math.max(1, value - 1))} disabled={pax <= 1} aria-label="Una persona menos" className="rl-chip rl-icon"><Minus size={15} /></button>
            <b className="w-8 text-center text-[20px]" aria-live="polite">{pax}</b>
            <button type="button" onClick={() => setPax((value) => Math.min(max, value + 1))} disabled={pax >= max} aria-label="Una persona más" className="rl-chip rl-icon"><Plus size={15} /></button>
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold">Idioma del guía</legend>
          <div className="flex flex-wrap gap-2">
            {listing.languages.map((code) => (
              <button key={code} type="button" aria-pressed={language === code} onClick={() => setLanguage(code)} className="rl-chip">{RL_LANGUAGES[code] ?? code}</button>
            ))}
          </div>
        </fieldset>
      </div>

      <label className="rl-field">Nombre<input className="rl-input" name="name" required minLength={2} maxLength={160} autoComplete="name" /></label>
      <label className="rl-field">Correo<input className="rl-input" name="email" type="email" required maxLength={160} autoComplete="email" /></label>
      <button type="button" role="switch" aria-checked={marketing} onClick={() => setMarketing((value) => !value)} className="flex items-start gap-3 text-left text-[13px]">
        <span className={`mt-0.5 flex h-5 w-9 flex-none items-center rounded-full p-0.5 transition ${marketing ? "bg-[var(--rl-cobalt)]" : "bg-[var(--rl-line-strong)]"}`}><span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${marketing ? "translate-x-4" : ""}`} /></span>
        <span className="rl-muted">Quiero recibir novedades de {agency} (opcional)</span>
      </button>

      {state.message && <p role="alert" className="rounded-2xl bg-[var(--rl-coral-soft)] px-4 py-3 text-[13.5px] font-semibold text-[var(--rl-coral)]">{state.message}</p>}

      <button type="submit" disabled={pending} className="rl-cta w-full"><Ticket size={17} />{pending ? "Reservando…" : paid ? `Reservar · ${formatMoney(listing.price, listing.currency)} por persona` : "Reservar gratis"}</button>
      <p className="rl-muted flex items-start gap-2 text-[12.5px]"><ShieldCheck size={15} className="mt-0.5 flex-none text-[var(--rl-emerald)]" />{paid ? "El pago se hace a la agencia. Recibirá las instrucciones por correo." : "Sin pago por adelantado. Cancele con un clic desde su correo."}</p>
    </form>
  );
}
