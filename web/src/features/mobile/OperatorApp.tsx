import { Ban, Bus, CalendarDays, CircleCheck, Clock3, ExternalLink, Home, ListChecks, MapPin, Phone, RefreshCw, Smartphone, Ticket, TriangleAlert, User, Users } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { OpsStep } from "@/features/operations/OpsStep";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { ChannelBadge } from "@/features/channels/ChannelUi";
import { SERVICE_KINDS } from "@/lib/channels";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import type { OperatorPreview, OperatorService } from "@/lib/mobile";
import { toneStyle, type Tone } from "@/lib/tone";
import { AppTabBar, PhoneFrame } from "./PhoneFrame";

const KIND_ICON: Record<string, typeof Bus> = { traslado: Bus, tour: MapPin, tren_entrada: Ticket };

const KIND_TONE: Record<string, Tone> = { traslado: "t4", tour: "t1", tren_entrada: "violet" };

const STEP_LABEL: Record<string, string> = { pendiente: "Por asignar", asignada: "Confirmar", confirmada: "Iniciar", en_curso: "Check-in", completada: "Completado" };

function ServiceCard({ service, index }: { service: OperatorService; index: number }) {
  const Icon = KIND_ICON[service.kind] ?? MapPin;
  const step = service.assignment ? STEP_LABEL[service.assignment] : "Sin asignación";
  return (
    <li style={{ ...toneStyle(KIND_TONE[service.kind] ?? "t1"), animationDelay: `${index * 70}ms` }} className="lift animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] rounded-2xl border border-line bg-surface p-3.5 shadow-card">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[var(--tint)] text-white shadow-[0_8px_16px_-10px_var(--tint)]">
          <Icon size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <b className="text-[15px] font-bold tracking-tight">{service.time ?? "Sin hora"}</b>
            <span className="text-[11px] font-semibold text-[var(--tint)]">{SERVICE_KINDS[service.kind] ?? service.kind}</span>
          </span>
          <span className="block text-[13px] font-semibold leading-snug">{service.name}</span>
          <span className="mt-0.5 block truncate text-[11.5px] text-fg-3">{service.reservation_title}</span>
        </span>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-[11.5px]">
        <span className="flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1"><Users size={12} /> {service.pax} pax</span>
        <span className="flex items-center gap-1 truncate rounded-lg bg-surface-2 px-2 py-1"><User size={12} /> {service.lead?.name.split(" ").slice(0, 2).join(" ") ?? "Sin titular"}</span>
        {service.vehicle && <span className="col-span-2 flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1"><Bus size={12} /> {service.vehicle}</span>}
        {(service.guide || service.driver) && <span className="col-span-2 flex items-center gap-1 rounded-lg bg-surface-2 px-2 py-1"><Users size={12} /> {[service.guide, service.driver].filter(Boolean).join(" · ")}</span>}
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        {service.lead?.phone ? <span className="flex items-center gap-1 text-[11.5px] text-fg-3"><Phone size={12} /> {service.lead.phone}</span> : <span />}
        <span className={cn("rounded-full px-3 py-1 text-[11.5px] font-semibold", service.assignment === "completada" ? "bg-ok/10 text-ok" : "bg-[var(--tint)] text-white")}>{step}</span>
      </div>
    </li>
  );
}

export function OperatorPhone({ preview }: { preview: OperatorPreview }) {
  const who = preview.selected_staff;
  return (
    <PhoneFrame
      clock={formatDate(preview.date).split(" ").slice(0, 2).join(" ")}
      footer={<AppTabBar active="day" items={[{ id: "day", label: "Mi día", icon: <Home size={16} /> }, { id: "list", label: "Servicios", icon: <ListChecks size={16} /> }, { id: "alerts", label: "Incidencias", icon: <TriangleAlert size={16} /> }, { id: "sync", label: "Sincronizar", icon: <RefreshCw size={16} /> }]} />}
    >
      <p className="text-[12px] font-semibold text-fg-3">{formatDate(preview.date, "long")}</p>
      <p className="text-[20px] font-bold tracking-tight">{who ? `Hola, ${who.name.split(" ")[0]}` : "Servicios del día"}</p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          { label: "Servicios", value: preview.kpis.services, tone: "t1" as Tone },
          { label: "Pasajeros", value: preview.kpis.pax, tone: "t4" as Tone },
          { label: "Confirmados", value: preview.kpis.confirmed, tone: "ok" as Tone },
        ].map((item) => (
          <span key={item.label} style={toneStyle(item.tone)} className="rounded-xl bg-[color-mix(in_srgb,var(--tint)_10%,var(--surface))] px-2 py-2">
            <b className="block text-[18px] leading-none text-[var(--tint)]">{item.value}</b>
            <span className="text-[10.5px] text-fg-3">{item.label}</span>
          </span>
        ))}
      </div>
      {preview.services.length === 0 ? (
        <p className="mt-8 text-center text-[13px] text-fg-3">No hay servicios de campo para este día.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-2.5">
          {preview.services.map((service, index) => (
            <ServiceCard key={service.code} service={service} index={index} />
          ))}
        </ul>
      )}
    </PhoneFrame>
  );
}

export function OperatorSide({ preview }: { preview: OperatorPreview }) {
  const staffParam = preview.selected_staff ? `&persona=${preview.selected_staff.code}` : "";
  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-3 sm:grid-cols-2">
        <TintTile icon={ListChecks} tone="t1" label="Servicios del día" value={preview.kpis.services} note={`${preview.kpis.pax} pasajeros en campo`} info="Servicios de campo (tours, traslados, tren) del día elegido, de reservas confirmadas." />
        <TintTile icon={User} tone="violet" label="Con guía o conductor" value={`${preview.kpis.assigned} de ${preview.kpis.services}`} note={preview.kpis.services - preview.kpis.assigned > 0 ? "Hay servicios por asignar" : "Todo asignado"} info="Servicios del día con guía o conductor asignado en Operaciones." />
        <TintTile icon={CircleCheck} tone="ok" label="Confirmados" value={preview.kpis.confirmed} note={`${preview.kpis.done} completados`} info="Asignaciones que el guía o conductor ya confirmó, inició o terminó desde la app." />
        <TintTile icon={Smartphone} tone="sun" label="Equipos activos" value={preview.devices.active} note={preview.devices.last_sync_at ? `Última sincronización ${formatDateTime(preview.devices.last_sync_at, false)}` : "Ninguno ha sincronizado"} info="Teléfonos con sesión abierta en la app del operador y no desactivados." />
      </section>
      <Card>
        <TintCardTitle icon={CalendarDays} title="Días con servicios" aside={`${preview.days.length}`} />
        <div className="flex flex-wrap gap-2">
          {preview.days.map((day) => {
            const active = day.date === preview.date;
            const today = day.date === preview.today;
            return (
              <Link key={day.date} href={`/mobile/operador?fecha=${day.date}${staffParam}`} className={cn("flex min-w-[76px] flex-col items-center rounded-xl border px-2.5 py-2 text-[12px] transition-transform duration-300 hover:-translate-y-0.5", active ? "border-accent bg-accent text-white" : "border-line bg-surface", today && !active && "border-accent/50")}>
                <span className={cn("font-semibold", !active && "text-fg")}>{formatDate(day.date).split(" ").slice(0, 2).join(" ")}</span>
                <span className={cn("text-[11px]", active ? "text-white/80" : "text-fg-3")}>{day.services} {day.services === 1 ? "servicio" : "servicios"}</span>
              </Link>
            );
          })}
        </div>
      </Card>
      <Card>
        <TintCardTitle icon={Clock3} title="Estado de los servicios" />
        {preview.services.length === 0 ? (
          <p className="text-[13px] text-fg-3">Sin servicios este día.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {preview.services.map((service) => (
              <li key={service.code} className="lift flex items-center justify-between gap-3 rounded-tile border border-line px-3 py-2">
                <span className="min-w-0">
                  <b className="block truncate text-[13px] font-semibold">{service.time ?? "—"} · {service.name}</b>
                  <span className="text-[12px] text-fg-3">{service.reservation}{service.confirmation ? ` · ${service.confirmation}` : ""}</span>
                </span>
                <span className="flex flex-none items-center gap-2">
                  {service.order && (
                    <Link href={`/operaciones/ordenes/${encodeURIComponent(service.order)}`} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11.5px] font-semibold text-link transition-colors hover:border-accent/50">
                      <ExternalLink size={12} /> Ver orden {service.order}
                    </Link>
                  )}
                  <ChannelBadge status={service.assignment ?? "pendiente"} label={service.assignment ? undefined : "Sin asignar"} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <TintCardTitle icon={RefreshCw} title="Sincronización de la app" aside={<InfoTip>Acciones que los teléfonos enviaron al servidor desde el {formatDate(preview.sync.since)} (tabla de acciones sincronizadas). Lo que aún espera señal queda en cada teléfono, en su bandeja de salida.</InfoTip>} />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Recibidas", value: preview.sync.received, tone: "t1" as Tone, hint: `${preview.sync.applied} aplicadas` },
            { label: "Sin conexión", value: preview.sync.offline, tone: "sun" as Tone, hint: "Se registraron sin señal" },
            { label: "Conflictos resueltos", value: preview.sync.conflicts, tone: "warn" as Tone, hint: "El servidor aplicó su regla" },
            { label: "Rechazadas", value: preview.sync.rejected, tone: "bad" as Tone, hint: "El teléfono revirtió el cambio" },
          ].map((item) => (
            <span key={item.label} style={toneStyle(item.tone)} className="lift rounded-xl bg-[color-mix(in_srgb,var(--tint)_9%,var(--surface))] px-3 py-2.5">
              <b className="block text-[20px] leading-none text-[var(--tint)]">{item.value}</b>
              <span className="mt-1 block text-[12px] font-semibold text-fg">{item.label}</span>
              <span className="block text-[11px] text-fg-3">{item.hint}</span>
            </span>
          ))}
        </div>
      </Card>
      <Card>
        <TintCardTitle icon={Smartphone} title="Teléfonos con la app" aside={`${preview.devices.items.length}`} />
        {preview.devices.items.length === 0 ? (
          <p className="text-[13px] text-fg-3">Ningún guía o conductor ha iniciado sesión en la app.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {preview.devices.items.map((device) => (
              <li key={device.id} className="lift flex items-center justify-between gap-3 rounded-tile border border-line px-3 py-2">
                <span className="min-w-0">
                  <b className="block truncate text-[13px] font-semibold">{device.user}</b>
                  <span className="text-[12px] text-fg-3">
                    {device.platform === "ios" ? "iPhone" : "Android"} · versión {device.version} · {device.last_sync_at ? `sincronizó ${formatDateTime(device.last_sync_at, false)}` : "sin sincronizar"}
                  </span>
                </span>
                <OpsStep step="device_revoke" target={device.id} label="Desactivar" size="sm" variant="ghost" icon={<Ban size={14} />} title="Desactivar teléfono" submitLabel="Desactivar" description={`El teléfono de ${device.user} dejará de sincronizar y borrará sus datos guardados la próxima vez que se conecte. Para volver a usarlo tendrá que iniciar sesión.`} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
