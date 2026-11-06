"use client";

import { CalendarHeart, CheckCircle2, Plane, TimerReset } from "lucide-react";
import { useState } from "react";
import { TintTile } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { PHASES, type PortalTripSummary, type TripPhase } from "@/lib/portal";
import { toneStyle } from "@/lib/tone";
import { EmptyLine, PortalTitle, TripCard } from "./PortalUi";

const FILTERS: { id: TripPhase | "todos"; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "proximo", label: "Próximos" },
  { id: "en_curso", label: "En viaje" },
  { id: "pasado", label: "Realizados" },
  { id: "cancelado", label: "Cancelados" },
];

export function PortalTrips({ trips }: { trips: PortalTripSummary[] }) {
  const [filter, setFilter] = useState<TripPhase | "todos">("todos");
  const count = (phase: TripPhase) => trips.filter((trip) => trip.phase === phase).length;
  const visible = filter === "todos" ? trips : trips.filter((trip) => trip.phase === filter);

  return (
    <>
      <PortalTitle title="Mis viajes" subtitle="Itinerario, pasajeros, documentos y pagos de cada viaje." />
      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TintTile icon={CalendarHeart} tone="t1" label="Total" value={trips.length} note="Viajes con nosotros" />
        <TintTile icon={Plane} tone="t3" label="Próximos" value={count("proximo")} note="Por empezar" />
        <TintTile icon={TimerReset} tone="t4" label="En viaje" value={count("en_curso")} note="En curso hoy" />
        <TintTile icon={CheckCircle2} tone="ok" label="Realizados" value={count("pasado")} note="Para recordar" />
      </section>
      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.filter((item) => item.id === "todos" || count(item.id) > 0).map((item) => {
          const active = filter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              style={item.id === "todos" ? undefined : toneStyle(PHASES[item.id].tone)}
              className={cn(
                "h-9 rounded-full border px-3.5 text-[13px] font-semibold transition hover:-translate-y-0.5",
                active ? "border-transparent bg-[var(--tint,var(--t1))] text-white" : "border-line bg-surface text-fg-2 hover:text-fg",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      {visible.length === 0 ? (
        <EmptyLine>No hay viajes en esta vista.</EmptyLine>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((trip, index) => (
            <TripCard key={trip.code} trip={trip} index={index} />
          ))}
        </ul>
      )}
    </>
  );
}
