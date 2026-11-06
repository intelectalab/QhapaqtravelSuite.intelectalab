"use client";

import { BadgePercent, CreditCard, Lock, Package, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { TintTile } from "@/components/ui/Tinted";
import { EmptyLine, PortalTitle } from "@/features/portal/PortalUi";
import type { AgencyCatalog, CatalogCard } from "@/lib/b2b-portal";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { toneStyle, type Tone } from "@/lib/tone";
import { CreditMeter, NetInfo, ProductCard } from "./AgencyUi";

type Filter = "todos" | "reservables" | "credito" | "sin_tarifa";

const FILTERS: { id: Filter; label: string; tone: Tone; matches: (row: CatalogCard) => boolean }[] = [
  { id: "todos", label: "Todos", tone: "t3", matches: () => true },
  { id: "reservables", label: "Reservables", tone: "ok", matches: (row) => row.bookable },
  { id: "credito", label: "Con crédito", tone: "t1", matches: (row) => row.credit },
  { id: "sin_tarifa", label: "Sin tarifa asignada", tone: "mute", matches: (row) => !row.bookable },
];

export function AgencyCatalogView({ catalog }: { catalog: AgencyCatalog }) {
  const [filter, setFilter] = useState<Filter>("todos");
  const [query, setQuery] = useState("");
  const bookable = catalog.products.filter((row) => row.bookable);
  const bestCommission = bookable.reduce<CatalogCard | null>((best, row) => (row.commission_pct !== null && (best === null || (row.commission_pct ?? 0) > (best.commission_pct ?? 0)) ? row : best), null);
  const visible = useMemo(() => {
    const active = FILTERS.find((item) => item.id === filter) ?? FILTERS[0];
    const needle = query.trim().toLowerCase();
    return catalog.products.filter((row) => active.matches(row) && (!needle || `${row.name} ${row.destination ?? ""} ${row.type}`.toLowerCase().includes(needle)));
  }, [catalog.products, filter, query]);

  return (
    <>
      <PortalTitle title="Catálogo" subtitle={<>Productos con tarifa neta para tu agencia, disponibilidad por fecha y comisión. <NetInfo /></>} />

      <section className="mb-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
        <TintTile icon={Package} tone="t3" label="Productos reservables" value={bookable.length} note={`de ${catalog.products.length} publicados para agencias`} />
        <TintTile
          icon={BadgePercent}
          tone="violet"
          label="Mejor comisión"
          value={bestCommission ? `${bestCommission.commission_pct} %` : "—"}
          note={bestCommission ? `${bestCommission.name} · ${formatMoney(bestCommission.commission ?? 0, bestCommission.currency ?? "USD")} por pasajero` : "Sin tarifas asignadas"}
        />
        <Card className="flex flex-col justify-center">
          <CreditMeter credit={catalog.credit} compact />
        </Card>
      </section>

      {catalog.blocked && (
        <p style={toneStyle("bad")} className="mb-4 flex items-center gap-2 rounded-tile border border-[color-mix(in_srgb,var(--tint)_30%,transparent)] bg-[color-mix(in_srgb,var(--tint)_8%,var(--surface))] px-4 py-3 text-[13px] font-medium text-[var(--tint)]">
          <Lock size={15} /> {catalog.blocked}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((item) => {
          const count = catalog.products.filter(item.matches).length;
          if (item.id !== "todos" && count === 0) return null;
          const active = filter === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              style={toneStyle(item.tone)}
              className={cn("flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition hover:-translate-y-0.5", active ? "border-transparent bg-[var(--tint)] text-white" : "border-line bg-surface text-fg-2 hover:text-fg")}
            >
              {item.id === "credito" && <CreditCard size={13} />}
              {item.label}
              <span className={cn("text-[11.5px]", active ? "text-white/80" : "text-fg-3")}>{count}</span>
            </button>
          );
        })}
        <label className="ml-auto flex h-9 w-full items-center gap-2 rounded-full border border-line bg-surface px-3.5 text-[13px] transition focus-within:border-t3 sm:w-64">
          <Search size={14} className="text-fg-3" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar producto o destino" className="w-full bg-transparent outline-none placeholder:text-fg-3" />
        </label>
      </div>

      {visible.length === 0 ? (
        <EmptyLine>No hay productos con ese criterio.</EmptyLine>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((product, index) => (
            <ProductCard key={product.code} product={product} index={index} />
          ))}
        </ul>
      )}
    </>
  );
}
