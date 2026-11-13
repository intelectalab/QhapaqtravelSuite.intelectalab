"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { FieldList } from "@/components/ui/Details";
import { SidePanel } from "@/components/ui/SidePanel";
import { PanelSection } from "@/features/catalog-shared/CatalogPanels";
import { CELL_STATE, isClosed, type AllotmentCell, type AllotmentSummary, type ConsumptionRow } from "@/lib/catalog-allotments";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import { toneStyle } from "@/lib/tone";
import { DayActions } from "./AllotmentForms";

export const weekday = (iso: string) => new Intl.DateTimeFormat("es-PE", { weekday: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`)).replace(".", "");

export function deadlineText(cell: AllotmentCell, today: string): string {
  if (!cell.deadline) return "—";
  if (cell.date < today) return formatDate(cell.deadline);
  const days = cell.to_deadline ?? 0;
  return `${formatDate(cell.deadline)} · ${days < 0 ? "vencido" : days === 0 ? "hoy" : `en ${days} días`}`;
}

export function CellButton({ cell, onClick, compact = false, today }: { cell: AllotmentCell; onClick?: () => void; compact?: boolean; today: string }) {
  const meta = CELL_STATE[cell.state];
  if (cell.state === "off") return <span className={cn("grid place-items-center rounded-[10px] bg-surface-2 text-[11px] text-fg-3", compact ? "h-11" : "h-12")}>—</span>;
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${formatDate(cell.date)} · ${meta.label} · cupo ${cell.capacity} · usado ${cell.used} · disponible ${cell.available}`}
      style={toneStyle(meta.tone)}
      className={cn(
        "group flex w-full flex-col items-center justify-center rounded-[10px] border border-[color-mix(in_srgb,var(--tint)_28%,transparent)] bg-[color-mix(in_srgb,var(--tint)_12%,var(--surface))] leading-none transition hover:-translate-y-0.5 hover:border-[var(--tint)] hover:shadow-[0_8px_18px_-12px_var(--tint)]",
        compact ? "h-11" : "h-12",
        cell.date === today && "ring-2 ring-accent ring-offset-1 ring-offset-surface",
        cell.state === "past" && "opacity-60",
      )}
    >
      <b className="text-[14px] font-bold">{cell.state === "over" ? `+${cell.over}` : cell.available}</b>
      <small className="mt-0.5 font-mono text-[10.5px] text-fg-3">
        {cell.used}/{cell.capacity}
        {cell.released ? ` · L${cell.released}` : ""}
      </small>
    </button>
  );
}

export function CellLegend() {
  const states = ["ok", "mid", "full", "rel", "ret", "over", "free"] as const;
  return (
    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-fg-3">
      <li>
        <b className="text-fg">N</b> disponible · usado/cupo · L liberado
      </li>
      {states.map((state) => (
        <li key={state} className="inline-flex items-center gap-1.5" style={toneStyle(CELL_STATE[state].tone)}>
          <span className="h-2.5 w-2.5 rounded-[3px] bg-[var(--tint)]" />
          {CELL_STATE[state].label}
        </li>
      ))}
    </ul>
  );
}

function ConsumptionList({ rows }: { rows: ConsumptionRow[] }) {
  if (!rows.length) return <p className="text-[13px] text-fg-3">Ninguna reserva consume este cupo en la fecha.</p>;
  return (
    <ul className="flex flex-col divide-y divide-line-2">
      {rows.map((row) => (
        <li key={`${row.reservation}-${row.service}`} className="flex items-center justify-between gap-3 py-2 text-[13px]">
          <span className="min-w-0">
            <Link href={`/reservas/${row.reservation}`} className="font-semibold text-accent hover:underline">{row.reservation}</Link>
            <small className="block truncate text-xs text-fg-3">{row.service}</small>
          </span>
          <span className="flex flex-none items-center gap-2">
            <b className="font-mono">{row.qty}</b>
            <Badge tone={row.state === "consumido" ? "ok" : "sun"}>{row.state === "consumido" ? "Consume" : "En trámite"}</Badge>
          </span>
        </li>
      ))}
    </ul>
  );
}

export function DayPanel({ contract, cell, today, canManage, onClose }: { contract: AllotmentSummary; cell: AllotmentCell | null; today: string; canManage: boolean; onClose: () => void }) {
  const editable = cell !== null && canManage && cell.date >= today && !cell.closed && !isClosed(contract.status);
  const capacity = cell ? (cell.capacity ?? (cell.blocked ?? 0) - (cell.released ?? 0)) : 0;
  const utilization = cell && capacity > 0 ? Math.round(((cell.used ?? 0) / capacity) * 100) : 0;
  const notice = !cell
    ? null
    : cell.over
      ? { tone: "bad" as const, text: `Sobreventa: ${cell.over} ${contract.unit} confirmadas por encima del cupo vigente. Tramítalas como a solicitud con el proveedor o pide una ampliación.` }
      : cell.state === "rel" && cell.deadline
        ? { tone: "warn" as const, text: `El release vence el ${formatDate(cell.deadline)}${cell.to_deadline === 0 ? " (hoy)" : cell.to_deadline !== undefined && cell.to_deadline > 0 ? ` (en ${cell.to_deadline} días)` : ""}. Si no se vende ni se retiene, el release automático liberará ${cell.available ?? 0} ${contract.unit}.` }
        : cell.state === "ret"
          ? { tone: "warn" as const, text: `Retenido después del release (${cell.retained ?? "sin motivo"}).${cell.exposure ? ` Si no se usa, la penalidad sería ${formatMoney(cell.exposure, contract.currency)}.` : ""}` }
          : null;
  return (
    <SidePanel open={cell !== null} onOpenChange={(open) => !open && onClose()} title={contract.name} description={cell ? `${weekday(cell.date)} ${formatDate(cell.date, "long")} · ${contract.provider.name}` : undefined}>
      {cell && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2" style={toneStyle(CELL_STATE[cell.state].tone)}>
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--tint)]" />
            <span className="text-[13px] font-semibold">{CELL_STATE[cell.state].label}</span>
          </div>
          {notice && <p role="status" className={cn("rounded-xl border px-3.5 py-2.5 text-[13px]", notice.tone === "bad" ? "border-bad/30 bg-bad/[0.07] text-bad" : "border-warn/35 bg-warn/[0.09] text-fg")}>{notice.text}</p>}
          <FieldList
            fields={[
              { label: "Bloqueado", value: `${cell.blocked} ${contract.unit}` },
              { label: "Liberado", value: cell.released },
              { label: "Usado", value: <b>{cell.used}</b> },
              { label: "En trámite", value: cell.pending },
              { label: "Disponible", value: <b>{cell.available}</b> },
              { label: "Utilización", value: `${utilization} %` },
              { label: "Release", value: deadlineText(cell, today) },
              { label: "Retención", value: cell.retained ?? "—" },
              ...(cell.charge ? [{ label: "Cargo por no uso", value: formatMoney(cell.charge, contract.currency) }] : []),
              ...(cell.exposure ? [{ label: "Exposición", value: <span className="font-semibold text-bad">{formatMoney(cell.exposure, contract.currency)}</span> }] : []),
            ]}
          />
          {cell.refs && (
            <PanelSection title="Reservas que consumen">
              <ConsumptionList rows={cell.refs} />
            </PanelSection>
          )}
          {editable && (
            <PanelSection title="Ajustar esta fecha">
              <DayActions contract={contract} cell={cell} />
            </PanelSection>
          )}
        </div>
      )}
    </SidePanel>
  );
}
