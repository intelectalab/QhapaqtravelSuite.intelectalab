"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { listingQuery, type ListingFacets, type ListingKey, type Option } from "@/lib/site";

type Params = Partial<Record<ListingKey, string>>;

const LABELS: Partial<Record<ListingKey, string>> = {
  destino: "Destino",
  tipo: "Tipo",
  fecha: "Fecha",
  viajeros: "Viajeros",
  duracion: "Duración",
  precio_min: "Precio mínimo",
  precio_max: "Precio máximo",
  categoria: "Categoría",
  dificultad: "Condición física",
  idioma: "Idioma del guía",
  modalidad: "Modalidad",
  q: "Texto",
};

function useListingNav(params: Params) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const go = (changes: Params) => {
    const next = { ...params, ...changes };
    startTransition(() => router.push(`${pathname}${listingQuery(next)}`, { scroll: false }));
  };
  return { go, pending };
}

function ChipFilter({ label, options, value, onChange }: { label: string; options: Option[]; value?: string; onChange: (value: string | undefined) => void }) {
  if (options.length === 0) return null;
  return (
    <fieldset>
      <legend className="mb-2 text-[12.5px] font-semibold text-fg">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(active ? undefined : option.value)}
              className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition hover:-translate-y-0.5", active ? "border-accent bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-accent" : "border-line text-fg-2 hover:border-fg-3/40")}
            >
              {option.label}
              {option.count !== undefined && <span className={cn("text-[11px]", active ? "text-accent/80" : "text-fg-3")}>{option.count}</span>}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ListingFilters({ facets, params }: { facets: ListingFacets; params: Params }) {
  const { go, pending } = useListingNav(params);
  const [open, setOpen] = useState(false);
  const [min, setMin] = useState(params.precio_min ?? "");
  const [max, setMax] = useState(params.precio_max ?? "");
  const active = (Object.keys(params) as ListingKey[]).filter((key) => key !== "orden" && LABELS[key]);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });

  return (
    <aside className={cn("transition-opacity", pending && "opacity-60")}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex h-11 w-full items-center justify-between rounded-control border border-line bg-surface px-4 text-[14px] font-semibold text-fg lg:hidden">
        <span className="inline-flex items-center gap-2">
          <SlidersHorizontal size={16} />
          Filtros {active.length > 0 && `(${active.length})`}
        </span>
        <span className="text-[12.5px] text-fg-3">{open ? "Ocultar" : "Mostrar"}</span>
      </button>
      <div className={cn("mt-3 space-y-5 rounded-card border border-line bg-surface p-4 shadow-card lg:mt-0 lg:block", open ? "block" : "hidden")}>
        {active.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {active.map((key) => (
              <button key={key} type="button" onClick={() => go({ [key]: undefined })} className="inline-flex h-7 items-center gap-1 rounded-full bg-surface-2 px-2.5 text-[11.5px] font-semibold text-fg-2 transition hover:bg-[color-mix(in_srgb,var(--bad)_10%,transparent)] hover:text-bad">
                {LABELS[key]}: {key === "destino" ? (facets.destinations.find((d) => d.value === params[key])?.label ?? params[key]) : params[key]}
                <X size={12} />
              </button>
            ))}
            <button type="button" onClick={() => go(Object.fromEntries(active.map((key) => [key, undefined])))} className="h-7 px-1 text-[11.5px] font-semibold text-accent hover:underline">
              Limpiar todo
            </button>
          </div>
        )}
        <div>
          <span className="mb-2 block text-[12.5px] font-semibold text-fg">Destino</span>
          <Select value={params.destino ?? ""} onChange={(value) => go({ destino: value || undefined })} options={[{ value: "", label: "Todos los destinos" }, ...facets.destinations.map((d) => ({ value: d.value, label: d.label, hint: `${d.count}` }))]} ariaLabel="Destino" />
        </div>
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <label>
            <span className="mb-2 block text-[12.5px] font-semibold text-fg">Fecha</span>
            <input type="date" min={today} value={params.fecha ?? ""} onChange={(event) => go({ fecha: event.target.value || undefined })} className="h-10 w-full rounded-control border border-line bg-surface px-3 text-[13.5px] text-fg outline-none focus:border-accent" />
          </label>
          <div>
            <span className="mb-2 block text-[12.5px] font-semibold text-fg">Viajeros</span>
            <Select value={params.viajeros ?? ""} onChange={(value) => go({ viajeros: value || undefined })} options={[{ value: "", label: "Todos" }, ...Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }))]} ariaLabel="Viajeros" className="w-[92px]" />
          </div>
        </div>
        <ChipFilter label="Tipo de experiencia" options={facets.kinds} value={params.tipo} onChange={(value) => go({ tipo: value })} />
        <ChipFilter label="Duración" options={facets.durations} value={params.duracion} onChange={(value) => go({ duracion: value })} />
        <fieldset>
          <legend className="mb-2 text-[12.5px] font-semibold text-fg">Precio por persona (S/)</legend>
          <form
            className="flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              go({ precio_min: min || undefined, precio_max: max || undefined });
            }}
          >
            <input inputMode="numeric" value={min} onChange={(event) => setMin(event.target.value.replace(/\D/g, ""))} placeholder="Mín." aria-label="Precio mínimo" className="h-10 w-full min-w-0 rounded-control border border-line bg-surface px-3 text-[13.5px] outline-none focus:border-accent" />
            <span className="text-fg-3">–</span>
            <input inputMode="numeric" value={max} onChange={(event) => setMax(event.target.value.replace(/\D/g, ""))} placeholder="Máx." aria-label="Precio máximo" className="h-10 w-full min-w-0 rounded-control border border-line bg-surface px-3 text-[13.5px] outline-none focus:border-accent" />
            <button type="submit" className="h-10 flex-none rounded-control bg-surface-2 px-3 text-[12.5px] font-semibold text-fg-2 transition hover:bg-accent hover:text-white">
              Aplicar
            </button>
          </form>
          <p className="mt-1.5 text-[11.5px] text-fg-3">Los precios en dólares se comparan al tipo de cambio del día.</p>
        </fieldset>
        <ChipFilter label="Categoría" options={facets.categories} value={params.categoria} onChange={(value) => go({ categoria: value })} />
        <ChipFilter label="Condición física" options={facets.difficulties} value={params.dificultad} onChange={(value) => go({ dificultad: value })} />
        <ChipFilter label="Idioma del guía" options={facets.languages} value={params.idioma} onChange={(value) => go({ idioma: value })} />
        <ChipFilter label="Modalidad" options={facets.modalities} value={params.modalidad} onChange={(value) => go({ modalidad: value })} />
      </div>
    </aside>
  );
}

export function SortSelect({ sorts, params }: { sorts: Option[]; params: Params }) {
  const { go } = useListingNav(params);
  return (
    <div className="flex items-center gap-2 text-[13px] text-fg-3">
      <span className="hidden sm:inline">Ordenar por</span>
      <Select value={params.orden ?? "recomendados"} onChange={(value) => go({ orden: value === "recomendados" ? undefined : value })} options={sorts} ariaLabel="Ordenar resultados" className="w-[210px]" />
    </div>
  );
}
