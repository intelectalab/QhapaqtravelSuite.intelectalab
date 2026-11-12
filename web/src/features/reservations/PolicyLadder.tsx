import { ChevronDown, MapPin } from "lucide-react";
import { cn } from "@/lib/cn";
import { tierRanges, type PenaltyTier } from "@/lib/catalog";

const tone = (pct: number) => (pct === 0 ? "var(--ok)" : pct >= 100 ? "var(--bad)" : pct >= 50 ? "var(--warn)" : "var(--sun, var(--warn))");

export function daysBetween(from: string, to: string): number {
  const [a, b] = [from, to].map((iso) => {
    const [year, month, day] = iso.slice(0, 10).split("-").map(Number);
    return Date.UTC(year, month - 1, day);
  });
  return Math.round((b - a) / 86_400_000);
}

function currentPct(tiers: PenaltyTier[], days: number): number {
  const sorted = [...tiers].sort((a, b) => b.min_days - a.min_days);
  return sorted.find((tier) => days >= tier.min_days)?.pct ?? 100;
}

export function PolicyLadder({ product, tiers, daysToTravel, texts }: { product: string; tiers: PenaltyTier[]; daysToTravel: number | null; texts: { label: string; value: string | null }[] }) {
  const rows = tierRanges(tiers);
  const now = daysToTravel !== null && daysToTravel >= 0 && tiers.length > 0 ? currentPct(tiers, daysToTravel) : null;
  const filled = texts.filter((text) => text.value);

  return (
    <div className="rounded-tile border border-line p-3.5">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <b className="text-[13.5px] font-semibold">{product}</b>
        {now !== null && (
          <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold" style={{ color: tone(now), background: `color-mix(in srgb, ${tone(now)} 12%, transparent)` }}>
            <MapPin size={13} /> Hoy, a {daysToTravel} {daysToTravel === 1 ? "día" : "días"}: {now === 0 ? "sin penalidad" : `${now} % de penalidad`}
          </span>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-[12.5px] text-fg-3">Sin tramos definidos: revisa el texto de la política.</p>
      ) : (
        <ol className="flex gap-1">
          {rows.map((row) => {
            const active = now !== null && row.pct === now;
            return (
              <li key={row.label} className="min-w-0 flex-1" title={`${row.label}: ${row.pct === 0 ? "sin penalidad" : `${row.pct} %`}`}>
                <span className={cn("block h-2.5 rounded-full transition", active && "ring-2 ring-offset-2 ring-offset-[var(--surface)]")} style={{ background: tone(row.pct), ["--tw-ring-color" as string]: tone(row.pct), opacity: now === null || active ? 1 : 0.45 }} />
                <span className="mt-1.5 block truncate text-[11.5px] text-fg-3">{row.label}</span>
                <span className="block font-mono text-[12px] font-semibold" style={{ color: tone(row.pct) }}>{row.pct === 0 ? "0 %" : `${row.pct} %`}</span>
              </li>
            );
          })}
        </ol>
      )}
      {filled.length > 0 && (
        <details className="group mt-3">
          <summary className="flex cursor-pointer list-none items-center gap-1 text-[12.5px] font-semibold text-t1">
            <ChevronDown size={14} className="transition group-open:rotate-180" /> Texto de las políticas
          </summary>
          <dl className="mt-2 grid gap-2 text-[12.5px] sm:grid-cols-2">
            {filled.map((text) => (
              <div key={text.label} className="rounded-lg bg-surface-2 px-3 py-2">
                <dt className="font-semibold text-fg-2">{text.label}</dt>
                <dd className="mt-0.5 text-fg-3">{text.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
    </div>
  );
}
