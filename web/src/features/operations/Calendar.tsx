"use client";

import { CalendarDays, ChevronLeft, ChevronRight, CircleAlert, List, Rows3, Truck, UsersRound } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { Select } from "@/components/ui/Select";
import { SidePanel } from "@/components/ui/SidePanel";
import { SOFT_TINT, TintCardTitle } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { capitalize, formatDate, formatDateTime, monthName } from "@/lib/format";
import type { CalendarEvent, CalendarMonth, ResourceOptions } from "@/lib/operations";
import { SERVICE_KIND } from "@/lib/reservations";
import { toneStyle, type Tone } from "@/lib/tone";
import { AssignAction } from "./OrderActions";
import { Meter, TimeSlot } from "./OpsBits";

const KIND: Record<string, { label: string; tone: Tone; icon: typeof UsersRound }> = {
  tour: { label: SERVICE_KIND.tour.label, icon: SERVICE_KIND.tour.icon, tone: "t1" },
  traslado: { label: SERVICE_KIND.traslado.label, icon: SERVICE_KIND.traslado.icon, tone: "t4" },
  alojamiento: { label: SERVICE_KIND.alojamiento.label, icon: SERVICE_KIND.alojamiento.icon, tone: "violet" },
  tren_entrada: { label: SERVICE_KIND.tren_entrada.label, icon: SERVICE_KIND.tren_entrada.icon, tone: "sun" },
  libre: { label: SERVICE_KIND.libre.label, icon: SERVICE_KIND.libre.icon, tone: "mute" },
  salida: { label: "Salida programada", icon: UsersRound, tone: "ok" },
};

const kindOf = (kind: string) => KIND[kind] ?? KIND.tour;

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

type View = "mes" | "semana" | "lista";

const VIEWS: { id: View; label: string; icon: ReactNode }[] = [
  { id: "mes", label: "Mes", icon: <CalendarDays size={15} /> },
  { id: "semana", label: "Semana", icon: <Rows3 size={15} /> },
  { id: "lista", label: "Lista", icon: <List size={15} /> },
];

const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const shift = (day: string, days: number) => {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + days);
  return iso(date);
};

function monthCells(month: string): string[] {
  const [year, index] = month.split("-").map(Number);
  const first = new Date(year, index - 1, 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(year, index - 1, 1 - offset);
  const days = Math.ceil((offset + new Date(year, index, 0).getDate()) / 7) * 7;
  return Array.from({ length: days }, (_, day) => iso(new Date(start.getFullYear(), start.getMonth(), start.getDate() + day)));
}

function weekOf(day: string): string[] {
  const offset = (new Date(`${day}T12:00:00`).getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, index) => shift(day, index - offset));
}

function EventChip({ event, onOpen }: { event: CalendarEvent; onOpen: (event: CalendarEvent) => void }) {
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(click) => {
        click.stopPropagation();
        onOpen(event);
      }}
      onKeyDown={(key) => {
        if (key.key === "Enter") {
          key.stopPropagation();
          onOpen(event);
        }
      }}
      style={toneStyle(kindOf(event.kind).tone)}
      title={`${event.time ?? ""} ${event.name}${event.pending_reason ? ` · ${event.pending_reason}` : ""}`}
      className={cn(
        "block cursor-pointer truncate rounded-[6px] bg-[color-mix(in_srgb,var(--tint)_14%,transparent)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--tint)] transition duration-200 hover:translate-x-0.5 hover:bg-[color-mix(in_srgb,var(--tint)_24%,transparent)]",
        event.pending && "outline-1 outline-dashed outline-[color-mix(in_srgb,var(--tint)_60%,transparent)]",
      )}
    >
      {event.time ? `${event.time} ` : ""}
      {event.name}
    </span>
  );
}

function EventRow({ event, index, onOpen }: { event: CalendarEvent; index: number; onOpen: (event: CalendarEvent) => void }) {
  const kind = kindOf(event.kind);
  const Icon = kind.icon;
  return (
    <li>
      <button type="button" onClick={() => onOpen(event)} style={{ ...toneStyle(kind.tone), animationDelay: `${index * 40}ms` }} className={cn("lift flex w-full animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] items-center gap-3 rounded-[12px] px-3 py-2.5 text-left", SOFT_TINT)}>
        <TimeSlot time={event.time} />
        <span className="grid h-8 w-8 flex-none place-items-center rounded-[9px] bg-surface text-[var(--tint)]">
          <Icon size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[13.5px] font-semibold">{event.name}</b>
          <span className="block truncate text-xs text-fg-3">
            {event.departure ? `${event.departure.ref} · ${event.departure.sold} de ${event.departure.capacity} cupos` : `${event.order?.code ?? event.reservation?.code} · ${event.reservation?.title ?? ""}`}
            {event.resources.length > 0 && ` · ${event.resources.join(", ")}`}
          </span>
        </span>
        {event.pending && (
          <span title={event.pending_reason ?? undefined} className="text-warn">
            <CircleAlert size={16} />
          </span>
        )}
        <StatusBadge status={event.assignment?.status ?? event.status} />
      </button>
    </li>
  );
}

function linkOr(href: string | null, label: ReactNode) {
  return href ? (
    <Link href={href} className="font-medium text-accent hover:underline">
      {label}
    </Link>
  ) : (
    label
  );
}

function EventPanel({ event, options, canAssign, canDepartures, onClose }: { event: CalendarEvent | null; options: ResourceOptions | null; canAssign: boolean; canDepartures: boolean; onClose: () => void }) {
  const kind = event ? kindOf(event.kind) : null;
  const departure = event?.departure ?? null;
  const assignment = event?.assignment ?? null;
  const assignable = Boolean(canAssign && options && assignment && !["completada", "en_curso"].includes(assignment.status) && !["completada", "cancelada"].includes(assignment.order_status));

  return (
    <SidePanel
      open={event !== null}
      onOpenChange={(open) => !open && onClose()}
      title={event ? (departure ? departure.product.name : event.name) : ""}
      description={event ? `${kind?.label ?? ""} · ${capitalize(formatDate(event.date, "long"))}${event.time ? ` · ${event.time}` : ""}` : undefined}
      footer={
        event ? (
          <div className="flex flex-wrap justify-end gap-2">
            {assignable && assignment && options && <AssignAction assignment={assignment} options={options} trigger={(open) => <Button icon={<Truck size={16} />} onClick={open}>{assignment.status === "pendiente" ? "Asignar recursos" : "Reasignar recursos"}</Button>} />}
            {departure ? canDepartures && <Button variant="primary" href="/catalogo/salidas">Abrir salidas</Button> : event.order ? <Button variant="primary" href={`/operaciones/ordenes/${event.order.code}`}>Abrir orden</Button> : event.reservation && <Button variant="primary" href={`/reservas/${event.reservation.code}`}>Abrir reserva</Button>}
          </div>
        ) : null
      }
    >
      {event && departure && (
        <div className="flex flex-col gap-4">
          <FieldList
            fields={[
              { label: "Producto", value: linkOr(canDepartures ? `/catalogo/productos/${departure.product.code}` : null, departure.product.name) },
              { label: "Salida", value: <span className="inline-flex items-center gap-2"><span className="font-mono text-[12.5px]">{departure.ref}</span><StatusBadge status={event.status} /></span> },
              { label: "Ocupación", value: <Meter value={departure.sold} total={departure.capacity} tone={departure.sold >= departure.capacity ? "sun" : "ok"} label={`${departure.sold} de ${departure.capacity} cupos`} /> },
              { label: "Guía", value: departure.guide ?? <span className="font-medium text-warn">Sin guía</span> },
              { label: "Vehículo", value: departure.vehicle ?? <span className="font-medium text-warn">Sin vehículo</span> },
              { label: "Encuentro", value: departure.meeting_point },
              { label: "Retorno", value: departure.return_point ?? "—" },
            ]}
          />
          <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[12.5px] text-fg-2">El guía y el vehículo de la salida se definen en Catálogo, Salidas y disponibilidad. Cuentan como ocupación al asignar órdenes.</p>
        </div>
      )}
      {event && !departure && (
        <div className="flex flex-col gap-5">
          <FieldList
            fields={[
              { label: "Estado", value: <StatusBadge status={event.status} /> },
              { label: "Reserva", value: event.reservation ? linkOr(`/reservas/${event.reservation.code}`, `${event.reservation.code} · ${event.reservation.title}`) : "—" },
              { label: "Cliente", value: event.client ? linkOr(`/crm/clientes/${event.client.code}`, event.client.name) : "—" },
              { label: "Pasajeros", value: event.passengers },
              { label: "Proveedor", value: event.provider ? linkOr(`/catalogo/proveedores/${encodeURIComponent(event.provider.code)}`, event.provider.name) : "—" },
              { label: "Confirmación", value: event.confirmation ? <span className="font-mono text-[12.5px]">{event.confirmation}</span> : "—" },
              { label: "Orden", value: event.order ? <span className="inline-flex items-center gap-2">{linkOr(`/operaciones/ordenes/${event.order.code}`, event.order.code)}<StatusBadge status={event.order.status} /></span> : <span className="text-fg-3">Sin orden operativa</span> },
            ]}
          />
          {assignment && (
            <section>
              <h3 className="mb-1 text-[13px] font-semibold text-fg-2">Asignación</h3>
              <FieldList
                fields={[
                  { label: "Estado", value: <StatusBadge status={assignment.status} /> },
                  { label: "Guía", value: assignment.guide?.name ?? "—" },
                  { label: "Conductor", value: assignment.driver?.name ?? "—" },
                  { label: "Vehículo", value: assignment.vehicle?.name ?? "—" },
                  { label: "Check-in", value: assignment.checkin_at ? formatDateTime(assignment.checkin_at) : "—" },
                ]}
              />
            </section>
          )}
          {event.pending_reason && (
            <p className="flex items-center gap-2 rounded-xl bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] px-3.5 py-3 text-[12.5px]">
              <CircleAlert size={15} className="flex-none text-warn" />
              {event.pending_reason}
            </p>
          )}
        </div>
      )}
    </SidePanel>
  );
}

function ListView({ events, onOpen }: { events: CalendarEvent[]; onOpen: (event: CalendarEvent) => void }) {
  if (events.length === 0) return <p className="px-4 py-6 text-[13.5px] text-fg-3">Sin servicios ni salidas en el mes.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-[13px]">
        <thead>
          <tr className="border-b border-line bg-surface-2 text-left text-[12px] font-semibold text-fg-3">
            <th className="px-4 py-2.5">Fecha</th>
            <th className="px-3 py-2.5">Tipo</th>
            <th className="px-3 py-2.5">Servicio</th>
            <th className="px-3 py-2.5">Reserva o salida</th>
            <th className="px-3 py-2.5">Recursos</th>
            <th className="px-4 py-2.5">Estado</th>
          </tr>
        </thead>
        <tbody>
          {events.map((event, index) => {
            const kind = kindOf(event.kind);
            return (
              <tr key={event.id} onClick={() => onOpen(event)} style={{ animationDelay: `${Math.min(index, 20) * 25}ms` }} className="cursor-pointer animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] border-b border-line-2 transition-colors hover:bg-surface-2">
                <td className="whitespace-nowrap px-4 py-2.5">
                  <b className="font-semibold">{formatDate(event.date)}</b> <TimeSlot time={event.time} className="text-xs" />
                </td>
                <td className="px-3 py-2.5">
                  <span style={toneStyle(kind.tone)} className="rounded-[6px] bg-[color-mix(in_srgb,var(--tint)_14%,transparent)] px-1.5 py-0.5 text-[11.5px] font-semibold text-[var(--tint)]">{kind.label}</span>
                </td>
                <td className="max-w-[240px] truncate px-3 py-2.5 font-medium">{event.name}</td>
                <td className="px-3 py-2.5 text-fg-2">{event.departure ? `${event.departure.ref} · ${event.departure.sold}/${event.departure.capacity}` : `${event.reservation?.code ?? ""}${event.client ? ` · ${event.client.name}` : ""}`}</td>
                <td className="max-w-[220px] truncate px-3 py-2.5 text-fg-2">{event.resources.join(" · ") || <span className={event.pending ? "text-warn" : "text-fg-3"}>—</span>}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={event.assignment?.status ?? event.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function OpsCalendar({ data }: { data: CalendarMonth }) {
  const [kind, setKind] = useState("");
  const [view, setView] = useState<View>("mes");
  const [selected, setSelected] = useState(data.month === data.today.slice(0, 7) ? data.today : `${data.month}-01`);
  const [openId, setOpenId] = useState<string | null>(null);
  const events = useMemo(() => data.events.filter((event) => !kind || event.kind === kind), [data.events, kind]);
  const byDay = useMemo(() => events.reduce<Record<string, CalendarEvent[]>>((days, event) => ({ ...days, [event.date]: [...(days[event.date] ?? []), event] }), {}), [events]);
  const cells = monthCells(data.month);
  const week = weekOf(selected);
  const horizon = shift(data.today, 13);
  const upcoming = events.filter((event) => event.date >= data.today && event.date <= horizon);
  const upcomingDays = [...new Set(upcoming.map((event) => event.date))];
  const dayEvents = byDay[selected] ?? [];
  const monthEvents = events.filter((event) => event.date.startsWith(data.month));
  const [year, month] = data.month.split("-").map(Number);
  const open = (event: CalendarEvent) => setOpenId(event.id);
  const opened = openId ? (data.events.find((event) => event.id === openId) ?? null) : null;
  const kindOptions = Object.entries(KIND).map(([value, item]) => ({ value, label: item.label }));

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Link href={`/operaciones/calendario?mes=${data.previous}`} aria-label="Mes anterior" className="grid h-9 w-9 place-items-center rounded-[10px] border border-line bg-surface text-fg-2 transition hover:-translate-x-0.5 hover:text-fg">
            <ChevronLeft size={17} />
          </Link>
          <h2 className="min-w-[170px] text-center text-[18px] font-bold tracking-tight">
            {capitalize(monthName(month - 1))} {year}
          </h2>
          <Link href={`/operaciones/calendario?mes=${data.next}`} aria-label="Mes siguiente" className="grid h-9 w-9 place-items-center rounded-[10px] border border-line bg-surface text-fg-2 transition hover:translate-x-0.5 hover:text-fg">
            <ChevronRight size={17} />
          </Link>
          {data.month !== data.today.slice(0, 7) && (
            <Link href="/operaciones/calendario" className="ml-2 text-[13px] font-semibold text-accent hover:underline">
              Hoy
            </Link>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div role="tablist" aria-label="Vista del calendario" className="inline-flex rounded-[11px] border border-line bg-surface p-0.5">
            {VIEWS.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={view === item.id} onClick={() => setView(item.id)} className={cn("inline-flex h-8 items-center gap-1.5 rounded-[9px] px-3 text-[13px] font-semibold transition", view === item.id ? "bg-accent text-white shadow-[0_6px_14px_-8px_var(--accent)]" : "text-fg-2 hover:bg-surface-2 hover:text-fg")}>
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>
          <Select variant="chip" value={kind} onChange={setKind} placeholder="Todos los tipos" options={kindOptions} ariaLabel="Tipo de servicio" />
        </div>
      </div>

      <div className="mb-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card padded={false} className="overflow-hidden">
          {view === "lista" ? (
            <ListView events={monthEvents} onOpen={open} />
          ) : (
            <>
              <div className="grid grid-cols-7 border-b border-line bg-surface-2 text-center text-[12px] font-semibold text-fg-3">
                {(view === "mes" ? WEEKDAYS : week.map((day) => `${WEEKDAYS[(new Date(`${day}T12:00:00`).getDay() + 6) % 7]} ${Number(day.slice(8))}`)).map((day) => (
                  <span key={day} className="py-2">
                    {day}
                  </span>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {(view === "mes" ? cells : week).map((day, index) => {
                  const list = byDay[day] ?? [];
                  const inMonth = day.startsWith(data.month);
                  const pending = list.some((event) => event.pending);
                  const limit = view === "mes" ? 3 : 12;
                  return (
                    <div
                      key={day}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelected(day)}
                      onKeyDown={(key) => key.key === "Enter" && setSelected(day)}
                      style={{ animationDelay: `${index * 12}ms` }}
                      className={cn(
                        "group relative flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] cursor-pointer flex-col gap-1 border-b border-r border-line-2 p-1.5 text-left transition-colors hover:bg-surface-2",
                        view === "mes" ? "min-h-[92px]" : "min-h-[260px]",
                        view === "mes" && !inMonth && "bg-surface-2/40 text-fg-3",
                        selected === day && "bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface))] ring-2 ring-inset ring-accent",
                      )}
                    >
                      <span className="flex items-center justify-between">
                        <span className={cn("grid h-6 min-w-6 place-items-center rounded-full px-1 text-[12px] font-semibold", day === data.today && "bg-accent text-white")}>{Number(day.slice(8))}</span>
                        {pending && <span className="h-2 w-2 rounded-full bg-warn" title="Hay servicios pendientes" />}
                      </span>
                      {list.slice(0, limit).map((event) => (
                        <EventChip key={event.id} event={event} onOpen={open} />
                      ))}
                      {list.length > limit && <span className="px-1 text-[11px] font-semibold text-fg-3">+{list.length - limit} más</span>}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </Card>

        <Card>
          <TintCardTitle icon={CalendarDays} title={capitalize(formatDate(selected, "long"))} aside={dayEvents.length === 1 ? "1 evento" : `${dayEvents.length} eventos`} />
          {dayEvents.length === 0 ? (
            <p className="text-[13.5px] text-fg-3">No hay servicios ni salidas este día.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {dayEvents.map((event, index) => (
                <EventRow key={event.id} event={event} index={index} onOpen={open} />
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <TintCardTitle icon={ChevronRight} title="Próximos 14 días" aside={upcoming.length === 1 ? "1 evento" : `${upcoming.length} eventos`} />
        {upcomingDays.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">Sin servicios programados en las próximas dos semanas.</p>
        ) : (
          <ol className="flex flex-col gap-4">
            {upcomingDays.map((day) => (
              <li key={day}>
                <p className={cn("mb-2 text-[13px] font-semibold first-letter:uppercase", day === data.today ? "text-accent" : "text-fg-2")}>
                  {formatDate(day, "long")}
                  {day === data.today && " · hoy"}
                </p>
                <ul className="flex flex-col gap-1.5">
                  {upcoming
                    .filter((event) => event.date === day)
                    .map((event, index) => (
                      <EventRow key={event.id} event={event} index={index} onOpen={open} />
                    ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </Card>

      <EventPanel event={opened} options={data.options} canAssign={data.can.assign} canDepartures={data.can.departures} onClose={() => setOpenId(null)} />
    </>
  );
}
