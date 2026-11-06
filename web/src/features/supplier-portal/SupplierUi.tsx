import { ArrowRight, BedDouble, Bus, CalendarClock, FileWarning, Map as MapIcon, ScrollText, Tags, Ticket, TimerReset, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { RISE, rise } from "@/features/portal/PortalUi";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import { dayDistance, deadlineLabel, scheduleLabel, supplierStatus, type SupplierAlert, type SupplierRequest, type SupplierScope } from "@/lib/supplier-portal";
import { toneStyle, type Tone } from "@/lib/tone";

export function SupplierBadge({ status, scope }: { status: string; scope: SupplierScope }) {
  const meta = supplierStatus(status, scope);
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

const KIND_ICONS: Record<string, LucideIcon> = { alojamiento: BedDouble, traslado: Bus, tour: MapIcon, tren_entrada: Ticket };

export function KindIcon({ kind, size = 17 }: { kind: string; size?: number }) {
  const Icon = KIND_ICONS[kind] ?? ScrollText;
  return <Icon size={size} />;
}

export function requestTone(row: SupplierRequest): Tone {
  if (row.state === "por_responder") return row.overdue ? "bad" : "warn";
  return supplierStatus(row.state, "request").tone;
}

export function RequestItem({ row, index, showDeadline = false }: { row: SupplierRequest; index: number; showDeadline?: boolean }) {
  const deadline = showDeadline ? deadlineLabel(row) : null;
  return (
    <li style={{ ...toneStyle(requestTone(row)), ...rise(index) }} className={RISE}>
      <Link href={`/proveedor/solicitudes/${row.code}`} className="lift group relative flex items-center gap-3 overflow-hidden rounded-tile border border-line bg-surface py-3 pl-4 pr-3.5">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-[var(--tint)] transition-[width] duration-300 group-hover:w-1.5" />
        <span className="grid h-10 w-10 flex-none place-items-center rounded-[11px] bg-[color-mix(in_srgb,var(--tint)_12%,var(--surface))] text-[var(--tint)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
          <KindIcon kind={row.kind} />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[13.5px] font-semibold">{row.service}</b>
          <span className="block truncate text-[12.5px] text-fg-3">
            {row.holder} · {row.pax} pax · {formatDate(row.date)} · {scheduleLabel(row)}
          </span>
          {deadline && <span className={cn("mt-0.5 flex items-center gap-1 text-[12px] font-medium", row.overdue ? "text-bad" : "text-warn")}><TimerReset size={13} /> {deadline}</span>}
        </span>
        <span className="flex flex-none flex-col items-end gap-1 text-right">
          <span className="text-[12px] font-semibold text-[var(--tint)]">{dayDistance(row.days_to)}</span>
          <span className="text-[12px] text-fg-3">{formatMoney(row.net_cost, row.currency)}</span>
        </span>
        <ArrowRight size={16} className="flex-none text-fg-3 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </li>
  );
}

const ALERT_ICONS: Record<SupplierAlert["kind"], LucideIcon> = { request: CalendarClock, contract: FileWarning, invoice: ScrollText, rate: Tags };

export function SupplierAlerts({ alerts }: { alerts: SupplierAlert[] }) {
  if (alerts.length === 0) return <p className="rounded-tile border border-dashed border-line px-4 py-5 text-center text-[13px] text-fg-3">Sin avisos. Todo está al día con la agencia.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {alerts.map((alert, index) => {
        const Icon = ALERT_ICONS[alert.kind];
        return (
          <li key={`${alert.kind}-${index}`} style={{ ...toneStyle(alert.tone), ...rise(index) }} className={RISE}>
            <Link href={alert.href} className="lift group flex items-center gap-3 rounded-tile border border-[color-mix(in_srgb,var(--tint)_25%,transparent)] bg-[color-mix(in_srgb,var(--tint)_7%,var(--surface))] px-3.5 py-3">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-[var(--tint)] text-white transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                <Icon size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[13.5px] font-semibold text-[var(--tint)]">{alert.title}</b>
                <span className="block text-[12.5px] text-fg-2">{alert.detail}</span>
              </span>
              <ArrowRight size={16} className="flex-none text-fg-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function PaxLine({ pax, rooms, nights }: { pax: number; rooms: number | null; nights: number | null }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-2">
      <Users size={13} /> {pax} pax
      {rooms ? ` · ${rooms} hab.` : ""}
      {nights ? ` · ${nights} ${nights === 1 ? "noche" : "noches"}` : ""}
    </span>
  );
}
