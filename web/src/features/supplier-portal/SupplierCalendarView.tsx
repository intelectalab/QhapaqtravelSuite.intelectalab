import { CalendarCheck2, ChevronLeft, ChevronRight, Users } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { TintTile } from "@/components/ui/Tinted";
import { EmptyLine, PortalTitle, RISE, rise } from "@/features/portal/PortalUi";
import { cn } from "@/lib/cn";
import { capitalize, monthName } from "@/lib/format";
import type { SupplierCalendar, SupplierRequest } from "@/lib/supplier-portal";
import { toneStyle } from "@/lib/tone";
import { KindIcon, RequestItem } from "./SupplierUi";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function shiftMonth(month: string, delta: number): string {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  return `${capitalize(monthName(Number(month.slice(5, 7)) - 1))} ${month.slice(0, 4)}`;
}

function cells(month: string): (string | null)[] {
  const [year, value] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, value - 1, 1));
  const days = new Date(Date.UTC(year, value, 0)).getUTCDate();
  const offset = (first.getUTCDay() + 6) % 7;
  const list: (string | null)[] = Array.from({ length: offset }, () => null);
  for (let day = 1; day <= days; day += 1) list.push(`${month}-${String(day).padStart(2, "0")}`);
  while (list.length % 7 !== 0) list.push(null);
  return list;
}

function Chip({ row }: { row: SupplierRequest }) {
  return (
    <Link href={`/proveedor/solicitudes/${row.code}`} style={toneStyle(row.status === "completado" ? "t1" : "ok")} title={`${row.service} · ${row.holder} · ${row.pax} pax`} className="group flex items-center gap-1.5 truncate rounded-[8px] bg-[color-mix(in_srgb,var(--tint)_12%,var(--surface))] px-1.5 py-1 text-[11.5px] font-semibold text-[var(--tint)] transition hover:-translate-y-0.5 hover:bg-[color-mix(in_srgb,var(--tint)_20%,var(--surface))]">
      <KindIcon kind={row.kind} size={12} />
      <span className="truncate">
        {row.time ?? ""} {row.holder.replace(/^(Grupo|Titular): /, "")}
      </span>
    </Link>
  );
}

export function SupplierCalendarView({ data }: { data: SupplierCalendar }) {
  const byDay = new Map<string, SupplierRequest[]>();
  for (const row of data.rows) byDay.set(row.date, [...(byDay.get(row.date) ?? []), row]);
  const pax = data.rows.reduce((sum, row) => sum + row.pax, 0);
  const busiest = [...byDay.entries()].sort((a, b) => b[1].length - a[1].length)[0];

  return (
    <>
      <PortalTitle
        title="Calendario"
        subtitle="Servicios confirmados con la agencia, día por día."
        actions={
          <div className="flex items-center gap-1 rounded-control border border-line bg-surface p-1">
            <Link href={`/proveedor/calendario?mes=${shiftMonth(data.month, -1)}`} aria-label="Mes anterior" className="grid h-8 w-8 place-items-center rounded-[10px] text-fg-2 transition hover:bg-surface-2 hover:text-fg">
              <ChevronLeft size={16} />
            </Link>
            <span className="min-w-[132px] text-center text-[13.5px] font-semibold">{monthLabel(data.month)}</span>
            <Link href={`/proveedor/calendario?mes=${shiftMonth(data.month, 1)}`} aria-label="Mes siguiente" className="grid h-8 w-8 place-items-center rounded-[10px] text-fg-2 transition hover:bg-surface-2 hover:text-fg">
              <ChevronRight size={16} />
            </Link>
          </div>
        }
      />

      <section className="mb-5 grid gap-3 sm:grid-cols-3">
        <TintTile icon={CalendarCheck2} tone="ok" label="Servicios del mes" value={data.rows.length} note={data.rows.length ? "Confirmados o realizados" : "Sin servicios confirmados"} />
        <TintTile icon={Users} tone="t1" label="Pasajeros del mes" value={pax} note="Suma de todos los servicios" />
        <TintTile icon={CalendarCheck2} tone="t3" label="Día con más servicios" value={busiest ? Number(busiest[0].slice(8, 10)) : "—"} note={busiest ? `${busiest[1].length} ${busiest[1].length === 1 ? "servicio" : "servicios"}` : "Sin actividad"} />
      </section>

      {data.months.length > 0 && (
        <div className="scroll-thin mb-4 flex gap-1.5 overflow-x-auto pb-1">
          {data.months.map((item, index) => (
            <Link
              key={item.month}
              href={`/proveedor/calendario?mes=${item.month}`}
              style={rise(index)}
              className={cn("flex h-8 flex-none items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition hover:-translate-y-0.5", RISE, item.month === data.month ? "border-t1 bg-[color-mix(in_srgb,var(--t1)_12%,var(--surface))] text-t1" : "border-line bg-surface text-fg-2 hover:text-fg")}
            >
              {monthLabel(item.month)}
              <span className="rounded-full bg-surface-2 px-1.5 text-[11px] text-fg-2">{item.count}</span>
            </Link>
          ))}
        </div>
      )}

      <Card padded={false} className="hidden overflow-hidden md:block">
        <div className="grid grid-cols-7 border-b border-line bg-surface-2 text-center text-[12px] font-semibold text-fg-3">
          {WEEKDAYS.map((day) => (
            <span key={day} className="py-2">
              {day}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells(data.month).map((day, index) => {
            const rows = day ? (byDay.get(day) ?? []) : [];
            return (
              <div key={day ?? `empty-${index}`} className={cn("min-h-[108px] border-b border-r border-line-2 p-1.5 transition-colors [&:nth-child(7n)]:border-r-0", !day && "bg-surface-2/40", day === data.today && "bg-[color-mix(in_srgb,var(--t1)_6%,var(--surface))]", rows.length > 0 && "hover:bg-surface-2/60")}>
                {day && <span className={cn("mb-1 inline-grid h-6 min-w-6 place-items-center rounded-full px-1 text-[12px] font-semibold", day === data.today ? "bg-t1 text-white" : "text-fg-3")}>{Number(day.slice(8, 10))}</span>}
                <div className="flex flex-col gap-1">
                  {rows.slice(0, 3).map((row) => (
                    <Chip key={row.code} row={row} />
                  ))}
                  {rows.length > 3 && <span className="px-1 text-[11px] text-fg-3">+{rows.length - 3} más</span>}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="md:hidden">
        {data.rows.length === 0 ? (
          <EmptyLine>No hay servicios confirmados en {monthLabel(data.month).toLowerCase()}.</EmptyLine>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.rows.map((row, index) => (
              <RequestItem key={row.code} row={row} index={index} />
            ))}
          </ul>
        )}
      </div>

      {data.rows.length > 0 && (
        <Card className="mt-5 hidden md:block">
          <h3 className="mb-3 text-[15px] font-semibold">Detalle del mes</h3>
          <ul className="flex flex-col gap-2">
            {data.rows.map((row, index) => (
              <RequestItem key={row.code} row={row} index={index} />
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
