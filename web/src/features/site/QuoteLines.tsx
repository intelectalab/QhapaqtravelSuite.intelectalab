"use client";

import { BedDouble, Bus, Compass, Loader2, RotateCcw, Sparkles, Tag, Ticket, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { QuoteLine, QuoteLineKind, TripCategory } from "@/lib/site";
import { useSite } from "./SiteContext";

const ORDER: QuoteLineKind[] = ["base", "option", "addon", "lodging", "surcharge", "tour", "transport"];

const KIND_ICON: Partial<Record<QuoteLineKind, typeof Ticket>> = {
  option: Sparkles,
  addon: Ticket,
  lodging: BedDouble,
  surcharge: Tag,
  tour: Compass,
  transport: Bus,
};

const CATEGORY_COLOR: Record<TripCategory, string> = {
  base: "bg-t1",
  lodging: "bg-t2",
  tour: "bg-t3",
  transport: "bg-t4",
  addon: "bg-accent",
  surcharge: "bg-fg-3",
};

export function TripCategories({ categories, currency }: { categories: Record<TripCategory, string>; currency: string }) {
  const { t } = useSite();
  const rows = (Object.keys(CATEGORY_COLOR) as TripCategory[]).map((key) => ({ key, amount: Number(categories[key] ?? 0) })).filter((row) => row.amount > 0);
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  if (rows.length === 0 || total <= 0) return null;
  return (
    <div data-testid="site-trip-categories" className="mt-1 rounded-xl border border-line p-3">
      <p className="mb-2 text-[12px] font-semibold text-fg-2">{t.booking.trip.byCategory}</p>
      <div className="flex h-2 overflow-hidden rounded-full bg-surface-2">
        {rows.map((row) => (
          <span key={row.key} className={cn("h-full transition-all duration-500", CATEGORY_COLOR[row.key])} style={{ width: `${(row.amount / total) * 100}%` }} title={`${t.booking.trip.categories[row.key]} · ${formatMoney(row.amount, currency)}`} />
        ))}
      </div>
      <ul className="mt-2 grid gap-1">
        {rows.map((row) => (
          <li key={row.key} className="flex items-center justify-between gap-3 text-[12.5px] text-fg-2">
            <span className="inline-flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", CATEGORY_COLOR[row.key])} />
              {t.booking.trip.categories[row.key]}
            </span>
            <span className="tabular-nums">
              {formatMoney(row.amount, currency)} <span className="text-fg-3">· {Math.round((row.amount / total) * 100)} %</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function sortLines(lines: QuoteLine[]): QuoteLine[] {
  return [...lines].sort((a, b) => ORDER.indexOf(a.kind ?? "base") - ORDER.indexOf(b.kind ?? "base"));
}

export function QuoteLines({ lines, currency, onToggle, busyKey, compact = false }: { lines: QuoteLine[]; currency: string; onToggle?: (line: QuoteLine) => void; busyKey?: string | null; compact?: boolean }) {
  const { t } = useSite();
  return (
    <ul className={cn("grid", compact ? "gap-1" : "gap-1.5")}>
      {sortLines(lines).map((line) => {
        const Icon = KIND_ICON[line.kind];
        const free = Number(line.amount) <= 0;
        return (
          <li key={line.key} className={cn("group flex items-start justify-between gap-3 text-[13px] transition", line.removed ? "text-fg-3" : "text-fg-2")}>
            <span className="flex min-w-0 items-start gap-2">
              {Icon && <Icon size={14} className={cn("mt-0.5 flex-none", line.removed ? "text-fg-3/60" : "text-t1")} />}
              <span className={cn("min-w-0", line.removed && "line-through decoration-fg-3/40")}>
                {line.label}
                {line.kind === "base" && Number(line.unit) > 0 && line.qty > 1 && <span className="text-fg-3"> × {formatMoney(line.unit, currency)}</span>}
              </span>
            </span>
            <span className="flex flex-none items-center gap-1.5">
              <span className={cn("tabular-nums", line.removed && "line-through decoration-fg-3/40")}>{free ? t.booking.free : formatMoney(line.amount, currency)}</span>
              {onToggle && line.removable && (
                <button
                  type="button"
                  onClick={() => onToggle(line)}
                  disabled={busyKey === line.key}
                  aria-label={`${line.removed ? t.booking.restoreItem : t.booking.removeItem}: ${line.label}`}
                  title={line.removed ? t.booking.restoreItem : t.booking.removeItem}
                  className={cn("grid h-6 w-6 place-items-center rounded-full border transition disabled:opacity-50", line.removed ? "border-accent text-accent hover:bg-accent hover:text-white" : "border-line text-fg-3 hover:border-bad hover:text-bad")}
                >
                  {busyKey === line.key ? <Loader2 size={11} className="animate-spin" /> : line.removed ? <RotateCcw size={11} /> : <X size={11} />}
                </button>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
