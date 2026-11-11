"use client";

import { CalendarDays, MapPin, Minus, Plus, Search, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { listingQuery, type Option } from "@/lib/site";
import { useSite } from "./SiteContext";

export function Stepper({ value, min, max, onChange, label, removeLabel, addLabel }: { value: number; min: number; max: number; onChange: (value: number) => void; label: string; removeLabel?: string; addLabel?: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" aria-label={removeLabel ?? `Quitar ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)} className="grid h-8 w-8 place-items-center rounded-full border border-line text-fg-2 transition hover:border-accent hover:text-accent disabled:opacity-40">
        <Minus size={14} />
      </button>
      <b className="w-7 text-center text-[15px] tabular-nums text-fg" aria-live="polite">
        {value}
      </b>
      <button type="button" aria-label={addLabel ?? `Agregar ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)} className="grid h-8 w-8 place-items-center rounded-full border border-line text-fg-2 transition hover:border-accent hover:text-accent disabled:opacity-40">
        <Plus size={14} />
      </button>
    </span>
  );
}

export function SearchBar({ destinations, className, initial }: { destinations: Option[]; className?: string; initial?: { destino?: string; fecha?: string; viajeros?: string } }) {
  const router = useRouter();
  const { href, t } = useSite();
  const [destino, setDestino] = useState(initial?.destino ?? "");
  const [fecha, setFecha] = useState(initial?.fecha ?? "");
  const [viajeros, setViajeros] = useState(Number(initial?.viajeros ?? 2));
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        router.push(href(`/buscar${listingQuery({ destino, fecha, viajeros: String(viajeros) })}`));
      }}
      className={cn("grid gap-2 rounded-[22px] border border-line bg-surface p-2 shadow-[0_24px_60px_-30px_rgb(14_17_32/0.55)] md:grid-cols-[1.3fr_1fr_1fr_auto]", className)}
      role="search"
    >
      <label className="flex min-w-0 items-center gap-3 rounded-2xl px-3 py-2 transition hover:bg-surface-2">
        <MapPin size={18} className="flex-none text-brand" />
        <span className="min-w-0 flex-1">
          <span className="block text-[11.5px] font-semibold text-fg-3">{t.search.destination}</span>
          <Select value={destino} onChange={setDestino} options={[{ value: "", label: t.search.allDestinations }, ...destinations]} placeholder={t.search.where} ariaLabel={t.search.destination} className="h-8! w-full border-0! bg-transparent! px-0! text-[14px]" />
        </span>
      </label>
      <label className="flex min-w-0 items-center gap-3 rounded-2xl px-3 py-2 transition hover:bg-surface-2">
        <CalendarDays size={18} className="flex-none text-brand" />
        <span className="min-w-0 flex-1">
          <span className="block text-[11.5px] font-semibold text-fg-3">{t.search.date}</span>
          <input type="date" value={fecha} min={today} onChange={(event) => setFecha(event.target.value)} aria-label={t.search.tripDate} className="h-8 w-full bg-transparent text-[14px] text-fg outline-none" />
        </span>
      </label>
      <div className="flex items-center gap-3 rounded-2xl px-3 py-2 transition hover:bg-surface-2">
        <Users size={18} className="flex-none text-brand" />
        <span className="min-w-0 flex-1">
          <span className="block text-[11.5px] font-semibold text-fg-3">{t.search.travelers}</span>
          <Stepper value={viajeros} min={1} max={20} onChange={setViajeros} label={t.search.traveler} removeLabel={t.common.remove(t.search.traveler)} addLabel={t.common.add(t.search.traveler)} />
        </span>
      </div>
      <button type="submit" data-site-cta className="inline-flex h-14 items-center justify-center gap-2 rounded-2xl bg-brand px-6 text-[15px] font-semibold text-brand-fg shadow-[0_10px_24px_-12px_var(--brand)] transition hover:-translate-y-0.5 hover:brightness-110">
        <Search size={18} />
        {t.search.submit}
      </button>
    </form>
  );
}
