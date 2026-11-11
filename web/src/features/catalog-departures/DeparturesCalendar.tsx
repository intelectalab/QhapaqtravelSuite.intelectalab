"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { DEPARTURE_STATUS, type DepartureRow, type DeparturesOverview } from "@/lib/catalog-departures";
import { cn } from "@/lib/cn";
import { capitalize, monthName } from "@/lib/format";
import { toneStyle, type Tone } from "@/lib/tone";
import { DepartureDetail } from "./DeparturesTable";

const WEEKDAYS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

function occupancyTone(departure: DepartureRow): Tone {
  if (departure.status === "cancelada" || departure.status === "cerrada") return DEPARTURE_STATUS[departure.status].tone;
  const taken = (departure.sold + departure.held) / Math.max(1, departure.capacity);
  return taken >= 1 ? "bad" : taken >= 0.75 ? "warn" : "ok";
}

export function DeparturesCalendar({ overview }: { overview: DeparturesOverview }) {
  const [month, setMonth] = useState(overview.today.slice(0, 7));
  const [year, index] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, index - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const length = new Date(Date.UTC(year, index, 0)).getUTCDate();
  const cells = Array.from({ length: Math.ceil((offset + length) / 7) * 7 }, (_, cell) => {
    const day = cell - offset + 1;
    return day >= 1 && day <= length ? `${month}-${String(day).padStart(2, "0")}` : null;
  });
  const shift = (delta: number) => {
    const next = new Date(Date.UTC(year, index - 1 + delta, 1));
    setMonth(next.toISOString().slice(0, 7));
  };
  const byDate = new Map<string, DepartureRow[]>();
  for (const departure of overview.departures) byDate.set(departure.date, [...(byDate.get(departure.date) ?? []), departure]);
  const inMonth = overview.departures.filter((departure) => departure.date.startsWith(month) && departure.status !== "cancelada");
  const seats = inMonth.reduce((sum, departure) => sum + departure.capacity, 0);
  const taken = inMonth.reduce((sum, departure) => sum + departure.sold + departure.held, 0);

  return (
    <div className="p-5">
      <div className="mb-4 flex flex-wrap items-center gap-2.5">
        <Button size="sm" iconOnly label="Mes anterior" icon={<ChevronLeft size={15} />} onClick={() => shift(-1)} />
        <h3 className="min-w-[150px] text-center text-[15px] font-semibold">{capitalize(monthName(`${month}-01`))} {year}</h3>
        <Button size="sm" iconOnly label="Mes siguiente" icon={<ChevronRight size={15} />} onClick={() => shift(1)} />
        <Button size="sm" onClick={() => setMonth(overview.today.slice(0, 7))}>Hoy</Button>
        <span className="ml-auto text-[13px] text-fg-3">
          {inMonth.length} salidas · {taken} de {seats} cupos ocupados
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((day) => (
          <span key={day} className="pb-1 text-center text-[11.5px] font-semibold text-fg-3">{day}</span>
        ))}
        {cells.map((date, cell) => {
          const rows = date ? (byDate.get(date) ?? []) : [];
          return (
            <div key={date ?? `blank-${cell}`} className={cn("min-h-[92px] rounded-xl border p-1.5", date ? "border-line bg-surface" : "border-transparent", date === overview.today && "border-accent")}>
              {date && (
                <>
                  <span className={cn("block px-1 font-mono text-[11.5px]", date === overview.today ? "font-bold text-accent" : "text-fg-3", date < overview.today && "opacity-60")}>{Number(date.slice(8, 10))}</span>
                  <ul className="mt-1 flex flex-col gap-1">
                    {rows.map((departure) => (
                      <li key={departure.ref}>
                        <DepartureDetail
                          departure={departure}
                          trigger={(open) => (
                            <button
                              type="button"
                              onClick={open}
                              style={toneStyle(occupancyTone(departure))}
                              title={`${departure.product.name} · ${departure.time} · ${departure.sold} vendidos, ${departure.held} en hold de ${departure.capacity}`}
                              className="flex w-full items-center justify-between gap-1 rounded-md bg-[color-mix(in_srgb,var(--tint)_14%,var(--surface))] px-1.5 py-1 text-left text-[11px] font-semibold transition hover:-translate-y-0.5 hover:bg-[color-mix(in_srgb,var(--tint)_24%,var(--surface))]"
                            >
                              <span className="min-w-0 truncate">{departure.time} {departure.product.name}</span>
                              <span className="flex-none font-mono text-[var(--tint)]">{departure.sold}/{departure.capacity}</span>
                            </button>
                          )}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
