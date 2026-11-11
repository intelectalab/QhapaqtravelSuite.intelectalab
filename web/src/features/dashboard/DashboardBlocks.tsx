import { ArrowRight, CalendarDays, TriangleAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/MiniTable";
import { SimpleTable } from "@/components/ui/SimpleTable";
import { TintCardTitle } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import type { DepartureRow, IncidentRow, ServiceRow } from "@/lib/dashboard";
import { formatDate } from "@/lib/format";
import { toneStyle, type Tone } from "@/lib/tone";

export type CanOpen = (href: string) => boolean;

export function shortDate(iso: string): string {
  return formatDate(iso).replace(/ \d{4}$/, "");
}

export function PanelLink({ href, can, children }: { href: string; can: CanOpen; children: ReactNode }) {
  if (!can(href)) return null;
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent hover:underline">
      {children}
      <ArrowRight size={13} strokeWidth={2.2} />
    </Link>
  );
}

export function MaybeLink({ href, can, children, className }: { href: string; can: CanOpen; children: ReactNode; className?: string }) {
  if (!can(href)) return <span className={className}>{children}</span>;
  return (
    <Link href={href} className={cn("hover:underline", className)}>
      {children}
    </Link>
  );
}

export function PanelCard({ icon, title, tone = "t1", aside, className, children }: { icon: LucideIcon; title: string; tone?: Tone; aside?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <Card className={cn("lift", className)}>
      <TintCardTitle icon={icon} title={title} tone={tone} aside={aside} />
      {children}
    </Card>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-[14px] border border-dashed border-line px-4 py-6 text-center text-[13px] text-fg-3">{children}</p>;
}

export interface RowItem {
  key: string;
  title: ReactNode;
  detail?: ReactNode;
  aside?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
}

export function RowList({ items, empty }: { items: RowItem[]; empty: string }) {
  if (items.length === 0) return <Empty>{empty}</Empty>;
  return (
    <ul>
      {items.map(({ key, title, detail, aside, icon: Icon, tone = "mute" }) => (
        <li key={key} className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-line-2 py-2.5 first:border-t-0">
          {Icon ? (
            <span style={toneStyle(tone)} className="tint-soft grid h-8 w-8 place-items-center rounded-[10px] transition-transform duration-200 group-hover:-rotate-6 group-hover:scale-110">
              <Icon size={15} />
            </span>
          ) : (
            <span />
          )}
          <span className="min-w-0">
            <span className="block truncate text-[13.5px] font-semibold">{title}</span>
            {detail && <span className="block truncate text-[12px] text-fg-3">{detail}</span>}
          </span>
          {aside && <span className="flex flex-col items-end gap-1 text-right text-[12.5px]">{aside}</span>}
        </li>
      ))}
    </ul>
  );
}

export function SubHeading({ children }: { children: ReactNode }) {
  return <p className="mb-1 mt-3 border-t border-line-2 pt-3 text-[12px] font-semibold text-fg-3 first:mt-0 first:border-t-0 first:pt-0">{children}</p>;
}

export function CriticalAlert({ incident, can }: { incident: IncidentRow | null; can: CanOpen }) {
  if (!incident) return null;
  return (
    <div style={toneStyle("bad")} className="tint-soft mb-4 flex flex-wrap items-center gap-3 rounded-[14px] px-4 py-3 text-[13px]">
      <TriangleAlert size={17} />
      <span className="min-w-0 flex-1">
        <b>Incidencia crítica abierta:</b> {incident.title}
        {incident.reservation && <span className="text-fg-2"> · {incident.reservation}</span>}
      </span>
      <PanelLink href={`/operaciones/incidencias/${incident.code}`} can={can}>
        Gestionar ahora
      </PanelLink>
    </div>
  );
}

export interface BarRow {
  key: string;
  label: string;
  value: number;
  display: string;
  tone?: Tone;
}

export function HBars({ rows, empty }: { rows: BarRow[]; empty: string }) {
  const max = Math.max(0, ...rows.map((row) => row.value));
  if (max === 0) return <Empty>{empty}</Empty>;
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row, index) => (
        <li key={row.key} className="group" style={toneStyle(row.tone ?? "t1")}>
          <div className="mb-1 flex justify-between gap-3 text-[13px]">
            <span className="font-medium">{row.label}</span>
            <span className="font-mono text-fg-2 transition-colors group-hover:text-fg">{row.display}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-2">
            <div className="h-full origin-left rounded-full bg-[var(--tint)] opacity-80 transition-opacity group-hover:opacity-100 motion-safe:animate-[fill-x_800ms_cubic-bezier(0.4,0,0.2,1)_backwards]" style={{ width: `${Math.max(3, (row.value / max) * 100)}%`, animationDelay: `${index * 90}ms` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function StatLine({ label, value, tone }: { label: string; value: ReactNode; tone?: Tone }) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line-2 py-2 text-[13px] first:border-t-0">
      <span className="text-fg-2">{label}</span>
      <b className="font-mono" style={tone ? { color: `var(--${tone})` } : undefined}>
        {value}
      </b>
    </div>
  );
}

export function ServicesTable({ rows, empty, can, extra }: { rows: ServiceRow[]; empty: string; can: CanOpen; extra?: { header: string; cell: (row: ServiceRow) => ReactNode } }) {
  return (
    <SimpleTable
      columns={[{ header: "Fecha" }, { header: "Servicio" }, { header: "Reserva" }, { header: "Pax", align: "right" }, { header: "Estado" }, ...(extra ? [{ header: extra.header }] : [])]}
      empty={empty}
      rows={rows.map((row) => ({
        key: row.id,
        cells: [
          <span key="date" className="whitespace-nowrap">
            <b>{shortDate(row.date)}</b> {row.time && <span className="text-fg-3">{row.time}</span>}
          </span>,
          <span key="name">
            <span className="block font-medium">{row.name}</span>
            {row.provider && <span className="block text-[12px] text-fg-3">{row.provider}</span>}
          </span>,
          <MaybeLink key="res" href={`/reservas/${row.reservation}`} can={can} className="font-mono text-[12.5px]">
            {row.reservation}
          </MaybeLink>,
          row.pax,
          <StatusBadge key="status" status={row.status} />,
          ...(extra ? [extra.cell(row)] : []),
        ],
      }))}
    />
  );
}

export function DepartureList({ rows, can }: { rows: DepartureRow[]; can: CanOpen }) {
  return (
    <PanelCard icon={CalendarDays} title="Salidas programadas y cupos" tone="t4" aside={<PanelLink href="/catalogo/salidas" can={can}>Salidas</PanelLink>}>
      {rows.length === 0 ? (
        <Empty>No hay salidas programadas.</Empty>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => {
            const pct = row.capacity > 0 ? (row.sold / row.capacity) * 100 : 0;
            return (
              <li key={row.ref} className="group">
                <div className="flex justify-between gap-3 text-[13px]">
                  <b className="truncate">{row.product}</b>
                  <span className="font-mono text-fg-2">
                    {row.sold}/{row.capacity}
                  </span>
                </div>
                <p className="mb-1.5 mt-0.5 text-[12px] text-fg-3">
                  {shortDate(row.date)}
                  {row.time && ` · ${row.time}`} · {row.guide ?? <span className="text-warn">sin guía</span>} · {Math.max(0, row.capacity - row.sold)} libres
                </p>
                <ProgressBar value={pct} tone={pct >= 100 ? "warn" : "ok"} />
              </li>
            );
          })}
        </ul>
      )}
    </PanelCard>
  );
}

const SEVERITY_TONE: Record<string, Tone> = { critica: "bad", alta: "warn", media: "info", baja: "mute" };

export function IncidentList({ rows, can, icon }: { rows: IncidentRow[]; can: CanOpen; icon: LucideIcon }) {
  return (
    <PanelCard icon={icon} title="Incidencias abiertas" tone="bad" aside={<PanelLink href="/operaciones/incidencias" can={can}>Incidencias</PanelLink>}>
      <RowList
        empty="No hay incidencias abiertas."
        items={rows.map((row) => ({
          key: row.code,
          icon: TriangleAlert,
          tone: SEVERITY_TONE[row.severity] ?? "mute",
          title: (
            <MaybeLink href={`/operaciones/incidencias/${row.code}`} can={can}>
              {row.title}
            </MaybeLink>
          ),
          detail: [row.code, row.reservation].filter(Boolean).join(" · "),
          aside: <StatusBadge status={row.severity} />,
        }))}
      />
    </PanelCard>
  );
}
