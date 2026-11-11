import { CalendarRange, ChevronLeft, ChevronRight, Plane, Ticket } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { TintCardTitle } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import type { Occupancy } from "@/lib/reservations";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const shiftMonth = (month: string, delta: number) => {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

const monthLabel = (month: string) => {
  const [year, value] = month.split("-").map(Number);
  const text = new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, value - 1, 1)));
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const shortDay = (date: string) => new Intl.DateTimeFormat("es-PE", { weekday: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));

export function OccupancyView({ data }: { data: Occupancy }) {
  const peak = Math.max(1, ...data.days.map((day) => day.pax));
  const nextPeak = Math.max(1, ...data.next.map((day) => day.pax));
  const offset = (new Date(`${data.days[0]?.date ?? `${data.month}-01`}T00:00:00Z`).getUTCDay() + 6) % 7;

  return (
    <div className="flex flex-col gap-5" data-testid="reservations-occupancy">
      <Card>
        <TintCardTitle
          icon={CalendarRange}
          title={`Pasajeros por día · ${monthLabel(data.month)}`}
          aside={
            <span className="flex items-center gap-1">
              <Link href={`/reservas?vista=ocupacion&mes=${shiftMonth(data.month, -1)}`} aria-label="Mes anterior" className="grid h-8 w-8 place-items-center rounded-control text-fg-2 hover:bg-surface-2">
                <ChevronLeft size={16} />
              </Link>
              <Link href={`/reservas?vista=ocupacion&mes=${shiftMonth(data.month, 1)}`} aria-label="Mes siguiente" className="grid h-8 w-8 place-items-center rounded-control text-fg-2 hover:bg-surface-2">
                <ChevronRight size={16} />
              </Link>
            </span>
          }
        />
        <div className="grid grid-cols-7 gap-1.5 text-[12px]">
          {WEEKDAYS.map((day) => (
            <span key={day} className="pb-1 text-center font-semibold text-fg-3">
              {day}
            </span>
          ))}
          {Array.from({ length: offset }).map((_, index) => (
            <span key={`blank-${index}`} />
          ))}
          {data.days.map((day) => {
            const level = day.pax === 0 ? 0 : Math.ceil((day.pax / peak) * 4);
            return (
              <div
                key={day.date}
                title={`${formatDate(day.date)} · ${day.pax} pasajeros en ${day.reservations} reservas`}
                style={{ background: level ? `color-mix(in srgb, var(--accent) ${level * 18}%, transparent)` : undefined }}
                className={cn("lift flex min-h-[54px] flex-col justify-between rounded-[10px] border p-1.5", day.date === data.today ? "border-accent" : "border-line-2", !level && "bg-surface-2/40")}
              >
                <span className="text-fg-3">{Number(day.date.slice(8))}</span>
                {day.pax > 0 && <b className={cn("text-right text-[13px] tabular-nums", level >= 3 && "text-white")}>{day.pax}</b>}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[12px] text-fg-3">Reservas no canceladas que tienen viaje ese día. El color es más intenso cuantos más pasajeros hay.</p>
      </Card>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Card>
          <TintCardTitle icon={Plane} title="Pasajeros de los próximos 14 días" />
          <ul className="flex flex-col gap-1.5">
            {data.next.map((day) => (
              <li key={day.date} className="group grid grid-cols-[72px_minmax(0,1fr)_36px] items-center gap-2 text-[12.5px]" title={`${day.reservations} reservas`}>
                <span className="text-fg-3">{shortDay(day.date)}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                  <span className="block h-full origin-left animate-[grow-x_600ms_ease-out_backwards] rounded-full bg-accent transition-opacity group-hover:opacity-80" style={{ width: `${(day.pax / nextPeak) * 100}%` }} />
                </span>
                <b className="text-right tabular-nums">{day.pax}</b>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <TintCardTitle icon={Ticket} title="Salidas de los próximos 14 días" aside={String(data.departures.length)} />
          {data.departures.length === 0 ? (
            <p className="text-[13.5px] text-fg-3">No hay salidas programadas en estos días.</p>
          ) : (
            <ul className="flex flex-col">
              {data.departures.map((departure) => (
                <li key={departure.ref} className="flex items-center gap-3 border-t border-line-2 py-2.5 text-[13px] first:border-t-0">
                  <span className="min-w-0 flex-1">
                    <b className="block truncate font-semibold">{departure.product}</b>
                    <span className="text-xs text-fg-3">
                      {departure.ref} · {formatDate(departure.date)}
                      {departure.time ? ` · ${departure.time}` : ""}
                    </span>
                  </span>
                  <span className="w-28 flex-none">
                    <span className="block h-2 overflow-hidden rounded-full bg-surface-2">
                      <span className={cn("block h-full rounded-full", departure.free === 0 ? "bg-bad" : departure.free <= 3 ? "bg-warn" : "bg-ok")} style={{ width: `${departure.capacity ? (departure.sold / departure.capacity) * 100 : 0}%` }} />
                    </span>
                    <span className="mt-0.5 block text-right text-xs text-fg-3">{departure.free === 0 ? "Sin cupos" : `${departure.free} libres de ${departure.capacity}`}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
