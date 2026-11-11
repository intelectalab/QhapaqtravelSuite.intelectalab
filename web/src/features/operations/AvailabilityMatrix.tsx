import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { TintCardTitle } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import type { AvailabilityCell, ResourceAvailability } from "@/lib/operations";
import { statusLabel, toneStyle, type Tone } from "@/lib/tone";

const WEEKDAY = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const LEGEND: { label: string; tone: Tone }[] = [
  { label: "Orden", tone: "t1" },
  { label: "Salida", tone: "ok" },
  { label: "Documento vencido", tone: "bad" },
  { label: "Fuera de servicio", tone: "mute" },
];

function Chip({ tone, title, children, done }: { tone: Tone; title?: string; children: string; done?: boolean }) {
  return (
    <span style={toneStyle(tone)} title={title} className={cn("block truncate rounded-[6px] bg-[color-mix(in_srgb,var(--tint)_14%,transparent)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--tint)] transition-transform duration-200 hover:translate-x-0.5", done && "opacity-60 line-through")}>
      {children}
    </span>
  );
}

function Cell({ cell, kind }: { cell: AvailabilityCell; kind: string }) {
  if (cell.state === "vacaciones" || cell.state === "mantenimiento") return <Chip tone="mute">{statusLabel(cell.state)}</Chip>;
  const docLabel = kind === "driver" ? "Licencia" : "SOAT";
  return (
    <span className="flex flex-col gap-1">
      {cell.document === "vencido" && <Chip tone="bad">{kind === "driver" ? "Licencia vencida" : "SOAT vencido"}</Chip>}
      {cell.document === "vence_hoy" && <Chip tone="bad">{`${docLabel} vence hoy`}</Chip>}
      {cell.items.map((item) => (
        <Chip key={`${item.source}-${item.ref}-${item.time}`} tone={item.source === "departure" ? "ok" : "t1"} done={item.done} title={`${item.time ?? ""} ${item.label} (${item.ref})`}>
          {`${item.time ?? ""} ${item.label}`.trim()}
        </Chip>
      ))}
      {cell.items.length === 0 && cell.state === "descanso" && <Chip tone="mute">Descanso</Chip>}
      {cell.items.length === 0 && cell.document === null && cell.state === "libre" && <span className="text-[11.5px] text-fg-3">Libre</span>}
    </span>
  );
}

export function AvailabilityMatrix({ data }: { data: ResourceAvailability }) {
  const nav = "grid h-8 w-8 place-items-center rounded-[10px] border border-line bg-surface text-fg-2 transition hover:text-fg";
  return (
    <Card padded={false} className="mb-5 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
        <TintCardTitle icon={CalendarRange} title="Disponibilidad de los próximos 7 días" aside={`Desde ${formatDate(data.from)}`} />
        <div className="mb-3 flex items-center gap-3">
          <span className="hidden flex-wrap items-center gap-3 text-[12px] text-fg-2 md:flex">
            {LEGEND.map((item) => (
              <span key={item.label} style={toneStyle(item.tone)} className="inline-flex items-center gap-1.5">
                <i className="h-2.5 w-2.5 rounded-full bg-[var(--tint)]" />
                {item.label}
              </span>
            ))}
          </span>
          <Link href={`/operaciones/asignaciones?desde=${data.previous}`} aria-label="Semana anterior" className={cn(nav, "hover:-translate-x-0.5")}>
            <ChevronLeft size={16} />
          </Link>
          {data.from !== data.today && (
            <Link href="/operaciones/asignaciones" className="text-[13px] font-semibold text-accent hover:underline">
              Hoy
            </Link>
          )}
          <Link href={`/operaciones/asignaciones?desde=${data.next}`} aria-label="Semana siguiente" className={cn(nav, "hover:translate-x-0.5")}>
            <ChevronRight size={16} />
          </Link>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] table-fixed text-[13px]">
          <thead>
            <tr className="border-y border-line bg-surface-2 text-left text-[12px] font-semibold text-fg-3">
              <th className="w-[210px] px-5 py-2.5">Recurso</th>
              {data.days.map((day) => (
                <th key={day} className={cn("px-2 py-2.5", day === data.today && "text-accent")}>
                  {WEEKDAY[new Date(`${day}T12:00:00`).getDay()]} {Number(day.slice(8))}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.groups.map((group) => (
              <GroupRows key={group.kind} group={group} today={data.today} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function GroupRows({ group, today }: { group: ResourceAvailability["groups"][number]; today: string }) {
  return (
    <>
      <tr>
        <td colSpan={8} className="bg-surface-2/60 px-5 py-1.5 text-[12px] font-semibold text-fg-2">
          {group.label} <span className="font-normal text-fg-3">· {group.rows.length}</span>
        </td>
      </tr>
      {group.rows.map((row, index) => (
        <tr key={row.id} style={{ animationDelay: `${Math.min(index, 12) * 30}ms` }} className="animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] border-b border-line-2 align-top transition-colors hover:bg-surface-2/50">
          <td className="px-5 py-2">
            <b className="block truncate text-[13px] font-semibold" title={row.name}>
              {row.name}
            </b>
            <span className="block truncate text-xs text-fg-3" title={row.sub}>
              {row.sub}
            </span>
          </td>
          {row.days.map((cell) => (
            <td key={cell.date} className={cn("px-2 py-2", cell.date === today && "bg-[color-mix(in_srgb,var(--accent)_5%,transparent)]")}>
              <Cell cell={cell} kind={row.kind} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
