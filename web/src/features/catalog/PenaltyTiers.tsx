"use client";

import { RowsEditor } from "@/components/ui/RowsEditor";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { tierRanges, type PenaltyTier } from "@/lib/catalog";

const tone = (pct: number) => (pct === 0 ? "var(--ok)" : pct < 100 ? "var(--warn)" : "var(--bad)");

export function PenaltyTiersView({ tiers, compact = false }: { tiers: PenaltyTier[]; compact?: boolean }) {
  const rows = tierRanges(tiers);
  if (rows.length === 0) return <p className="text-[13px] text-fg-3">Sin tramos: se cobra el 100 % al cancelar.</p>;
  return (
    <ol className={cn("grid gap-1.5", !compact && "sm:grid-cols-2")}>
      {rows.map((row, index) => (
        <li key={row.label} style={{ animationDelay: `${index * 60}ms`, ["--tint" as string]: tone(row.pct) }} className="lift flex animate-[rise-in_380ms_cubic-bezier(0.22,1,0.36,1)_backwards] items-center gap-3 rounded-xl border border-[color-mix(in_srgb,var(--tint)_25%,transparent)] bg-[color-mix(in_srgb,var(--tint)_7%,var(--surface))] px-3.5 py-2.5 text-[13px]">
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">{row.label}</span>
            <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--tint)_15%,transparent)]">
              <span className="block h-full rounded-full bg-[var(--tint)]" style={{ width: `${Math.max(row.pct, 3)}%` }} />
            </span>
          </span>
          <span className="flex-none font-mono text-[13px] font-semibold text-[var(--tint)]">{row.pct === 0 ? "Sin penalidad" : `${row.pct} %`}</span>
        </li>
      ))}
    </ol>
  );
}

export function PenaltyTiersEditor({ tiers, onChange, fromText, error }: { tiers: PenaltyTier[]; onChange: (tiers: PenaltyTier[]) => void; fromText?: boolean; error?: string }) {
  const number = (value: string) => (value === "" ? Number.NaN : Number(value));
  return (
    <div className="grid gap-3">
      {fromText && <p className="rounded-xl bg-[color-mix(in_srgb,var(--info)_10%,transparent)] px-3.5 py-2.5 text-[12.5px] text-fg-2">Estos tramos se dedujeron del texto de la política. Revísalos y guarda para fijarlos.</p>}
      {error && <p className="text-[12.5px] text-bad">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <RowsEditor
          testId="field:penalty_tiers"
          rows={tiers}
          onChange={onChange}
          create={() => ({ min_days: 0, pct: 100 })}
          itemLabel="Tramo"
          addLabel="Agregar tramo"
          empty="Sin tramos, cancelar cuesta el 100 %."
          max={8}
          reorder={false}
          render={(row, update, index) => (
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Desde (días antes)" name={`penalty_tiers.${index}.min_days`} type="number" inputMode="numeric" min={0} max={365} value={Number.isNaN(row.min_days) ? "" : String(row.min_days)} onChange={(event) => update({ min_days: number(event.target.value) })} />
              <TextField label="Penalidad (%)" name={`penalty_tiers.${index}.pct`} type="number" inputMode="numeric" min={0} max={100} value={Number.isNaN(row.pct) ? "" : String(row.pct)} onChange={(event) => update({ pct: number(event.target.value) })} />
            </div>
          )}
        />
        <div>
          <span className="mb-1.5 block text-[13px] font-semibold text-fg">Así se cobra</span>
          <PenaltyTiersView tiers={tiers} compact />
        </div>
      </div>
    </div>
  );
}
