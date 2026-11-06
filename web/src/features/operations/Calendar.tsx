"use client";

import { ChevronLeft, ChevronRight, CircleAlert } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { SOFT_TINT, TintCardTitle } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { capitalize, formatDate, monthName } from "@/lib/format";
import type { CalendarEvent, CalendarMonth } from "@/lib/operations";
import { SERVICE_KIND } from "@/lib/reservations";
import { toneStyle, type Tone } from "@/lib/tone";
import { TimeSlot } from "./OpsBits";

const KIND_TONE: Record<string, Tone> = { tour: "t1", traslado: "t4", alojamiento: "violet", tren_entrada: "sun", libre: "mute" };

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

function monthCells(month: string): string[] {
  const [year, index] = month.split("-").map(Number);
  const first = new Date(year, index - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, index - 1, 1 - offset);
  const days = Math.ceil((offset + new Date(year, index, 0).getDate()) / 7) * 7;
  return Array.from({ length: days }, (_, day) => iso(new Date(start.getFullYear(), start.getMonth(), start.getDate() + day)));
}

function EventRow({ event, index }: { event: CalendarEvent; index: number }) {
  const kind = SERVICE_KIND[event.kind] ?? SERVICE_KIND.tour;
  const Icon = kind.icon;
  return (
    <li style={{ ...toneStyle(KIND_TONE[event.kind] ?? "t1"), animationDelay: `${index * 40}ms` }} className={cn("lift flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] items-center gap-3 rounded-[12px] px-3 py-2.5", SOFT_TINT)}>
      <TimeSlot time={event.time} />
      <span className="grid h-8 w-8 flex-none place-items-center rounded-[9px] bg-surface text-[var(--tint)]">
        <Icon size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <b className="block truncate text-[13.5px] font-semibold">{event.name}</b>
        <span className="block truncate text-xs text-fg-3">
          {event.order ? (
            <Link href={`/operaciones/ordenes/${event.order.code}`} className="hover:text-accent hover:underline">
              {event.order.code}
            </Link>
          ) : (
            <Link href={`/reservas/${event.reservation.code}`} className="hover:text-accent hover:underline">
              {event.reservation.code}
            </Link>
          )}
          {" · "}
          {event.reservation.title}
          {event.resources.length > 0 && ` · ${event.resources.join(", ")}`}
        </span>
      </span>
      {event.pending && (
        <span title={event.pending_reason ?? undefined} className="text-warn">
          <CircleAlert size={16} />
        </span>
      )}
      <StatusBadge status={event.assignment ?? event.status} />
    </li>
  );
}

export function OpsCalendar({ data }: { data: CalendarMonth }) {
  const [kind, setKind] = useState("");
  const [selected, setSelected] = useState(data.month === data.today.slice(0, 7) ? data.today : `${data.month}-01`);
  const events = useMemo(() => data.events.filter((event) => !kind || event.kind === kind), [data.events, kind]);
  const byDay = useMemo(() => events.reduce<Record<string, CalendarEvent[]>>((days, event) => ({ ...days, [event.date]: [...(days[event.date] ?? []), event] }), {}), [events]);
  const cells = monthCells(data.month);
  const horizon = iso(new Date(new Date(`${data.today}T12:00:00`).getTime() + 13 * 86400000));
  const upcoming = events.filter((event) => event.date >= data.today && event.date <= horizon);
  const upcomingDays = [...new Set(upcoming.map((event) => event.date))];
  const dayEvents = byDay[selected] ?? [];
  const [year, month] = data.month.split("-").map(Number);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Link href={`/operaciones/calendario?mes=${data.previous}`} aria-label="Mes anterior" className="grid h-9 w-9 place-items-center rounded-[10px] border border-line bg-surface text-fg-2 transition hover:-translate-x-0.5 hover:text-fg">
            <ChevronLeft size={17} />
          </Link>
          <h2 className="min-w-[170px] text-center text-[18px] font-bold tracking-tight">
            {capitalize(monthName(month - 1))} {year}
          </h2>
          <Link href={`/operaciones/calendario?mes=${data.next}`} aria-label="Mes siguiente" className="grid h-9 w-9 place-items-center rounded-[10px] border border-line bg-surface text-fg-2 transition hover:translate-x-0.5 hover:text-fg">
            <ChevronRight size={17} />
          </Link>
          {data.month !== data.today.slice(0, 7) && (
            <Link href="/operaciones/calendario" className="ml-2 text-[13px] font-semibold text-accent hover:underline">
              Hoy
            </Link>
          )}
        </div>
        <Select variant="chip" value={kind} onChange={setKind} placeholder="Todos los tipos" options={Object.entries(SERVICE_KIND).filter(([value]) => value !== "transporte").map(([value, item]) => ({ value, label: item.label }))} ariaLabel="Tipo de servicio" />
      </div>

      <div className="mb-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card padded={false} className="overflow-hidden">
          <div className="grid grid-cols-7 border-b border-line bg-surface-2 text-center text-[12px] font-semibold text-fg-3">
            {WEEKDAYS.map((day) => (
              <span key={day} className="py-2">
                {day}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((day, index) => {
              const list = byDay[day] ?? [];
              const inMonth = day.startsWith(data.month);
              const pending = list.some((event) => event.pending);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => setSelected(day)}
                  style={{ animationDelay: `${index * 12}ms` }}
                  className={cn(
                    "group relative flex min-h-[92px] animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-col gap-1 border-b border-r border-line-2 p-1.5 text-left transition-colors hover:bg-surface-2",
                    !inMonth && "bg-surface-2/40 text-fg-3",
                    selected === day && "bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface))] ring-2 ring-inset ring-accent",
                  )}
                >
                  <span className="flex items-center justify-between">
                    <span className={cn("grid h-6 min-w-6 place-items-center rounded-full px-1 text-[12px] font-semibold", day === data.today && "bg-accent text-white")}>{Number(day.slice(8))}</span>
                    {pending && <span className="h-2 w-2 rounded-full bg-warn" title="Hay servicios pendientes" />}
                  </span>
                  {list.slice(0, 3).map((event) => (
                    <span key={event.code} style={toneStyle(KIND_TONE[event.kind] ?? "t1")} title={`${event.time ?? ""} ${event.name}`} className="truncate rounded-[6px] bg-[color-mix(in_srgb,var(--tint)_14%,transparent)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--tint)] transition-transform duration-200 group-hover:translate-x-0.5">
                      {event.time ? `${event.time} ` : ""}
                      {event.name}
                    </span>
                  ))}
                  {list.length > 3 && <span className="px-1 text-[11px] font-semibold text-fg-3">+{list.length - 3} más</span>}
                </button>
              );
            })}
          </div>
        </Card>

        <Card>
          <TintCardTitle icon={SERVICE_KIND.tour.icon} title={capitalize(formatDate(selected, "long"))} aside={dayEvents.length === 1 ? "1 servicio" : `${dayEvents.length} servicios`} />
          {dayEvents.length === 0 ? <p className="text-[13.5px] text-fg-3">No hay servicios este día.</p> : <ul className="flex flex-col gap-2">{dayEvents.map((event, index) => <EventRow key={event.code} event={event} index={index} />)}</ul>}
        </Card>
      </div>

      <Card>
        <TintCardTitle icon={ChevronRight} title="Próximos 14 días" aside={upcoming.length === 1 ? "1 servicio" : `${upcoming.length} servicios`} />
        {upcomingDays.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">Sin servicios programados en las próximas dos semanas.</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {upcomingDays.map((day) => (
              <li key={day}>
                <p className={cn("mb-2 text-[13px] font-semibold first-letter:uppercase", day === data.today ? "text-accent" : "text-fg-2")}>
                  {formatDate(day, "long")}
                  {day === data.today && " · hoy"}
                </p>
                <ul className="flex flex-col gap-1.5">
                  {upcoming
                    .filter((event) => event.date === day)
                    .map((event, index) => (
                      <EventRow key={event.code} event={event} index={index} />
                    ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </>
  );
}
