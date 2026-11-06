import { BellRing, Bus, CalendarCheck2, CalendarDays, FileText, Hotel, Map as MapIcon, MapPin, MessageCircle, Plane, Ticket, TriangleAlert, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { ChannelBadge } from "@/features/channels/ChannelUi";
import { SERVICE_KINDS } from "@/lib/channels";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import type { PassengerTrip } from "@/lib/mobile";
import { toneStyle } from "@/lib/tone";
import { AppTabBar, PhoneFrame } from "./PhoneFrame";

const KIND_ICON: Record<string, typeof Bus> = { traslado: Bus, tour: MapPin, tren_entrada: Ticket, alojamiento: Hotel, libre: CalendarDays };

function TripHero({ trip }: { trip: PassengerTrip }) {
  const progress = trip.day ? (trip.day / trip.days_total) * 100 : trip.status === "completada" ? 100 : 0;
  return (
    <div style={toneStyle("t1")} className="relative overflow-hidden rounded-2xl bg-[var(--tint)] p-4 text-white shadow-[0_14px_28px_-18px_var(--tint)]">
      <span aria-hidden className="weave-pattern absolute inset-0 bg-[length:22px_22px] opacity-[0.12]" />
      <p className="relative text-[11.5px] font-semibold opacity-85">{trip.day ? `Día ${trip.day} de ${trip.days_total}` : trip.status === "completada" ? "Viaje finalizado" : `Empieza el ${formatDate(trip.from)}`}</p>
      <p className="relative mt-0.5 text-[17px] font-bold leading-snug">{trip.title}</p>
      <p className="relative text-[11.5px] opacity-85">{formatDate(trip.from)} – {formatDate(trip.to)} · {trip.passengers.length} pasajeros</p>
      <span className="relative mt-3 block h-1.5 overflow-hidden rounded-full bg-white/25">
        <span className="block h-full origin-left rounded-full bg-white motion-safe:animate-[fill-x_800ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ width: `${Math.max(4, progress)}%` }} />
      </span>
    </div>
  );
}

export function PassengerPhone({ trip, today }: { trip: PassengerTrip; today: string }) {
  const days = trip.itinerary.filter((day) => day.date >= today).slice(0, 3);
  const visible = days.length > 0 ? days : trip.itinerary.slice(-2);
  return (
    <PhoneFrame
      clock={formatDate(today).split(" ").slice(0, 2).join(" ")}
      footer={<AppTabBar active="trip" items={[{ id: "trip", label: "Mi viaje", icon: <Plane size={16} /> }, { id: "plan", label: "Itinerario", icon: <MapIcon size={16} /> }, { id: "docs", label: "Vouchers", icon: <FileText size={16} /> }, { id: "chat", label: "Chat", icon: <MessageCircle size={16} /> }]} />}
    >
      <TripHero trip={trip} />
      {trip.alerts.map((alert) => (
        <div key={alert.code} className="mt-3 flex gap-2 rounded-xl border border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,var(--surface))] p-3">
          <TriangleAlert size={16} className="mt-0.5 flex-none text-warn" />
          <span>
            <b className="block text-[12.5px] font-semibold">{alert.title}</b>
            {alert.message && <span className="text-[11.5px] text-fg-2">{alert.message}</span>}
          </span>
        </div>
      ))}
      {trip.next && (
        <div className="mt-3 rounded-xl border border-line bg-surface p-3">
          <p className="text-[11px] font-semibold text-accent">Próximo servicio</p>
          <p className="text-[13.5px] font-semibold">{trip.next.name}</p>
          <p className="text-[11.5px] text-fg-3">{formatDate(trip.next.date, "long")}{trip.next.time ? ` · ${trip.next.time}` : ""}</p>
        </div>
      )}
      <div className="mt-4 flex flex-col gap-3">
        {visible.map((day, dayIndex) => (
          <section key={day.date} style={{ animationDelay: `${dayIndex * 80}ms` }} className="animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
            <p className="mb-1.5 text-[12px] font-semibold text-fg-2">Día {day.day} · {formatDate(day.date, "long")}</p>
            <ul className="flex flex-col gap-1.5">
              {day.services.map((service) => {
                const Icon = KIND_ICON[service.kind] ?? MapPin;
                return (
                  <li key={service.code} className="lift flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2">
                    <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-accent/10 text-accent"><Icon size={15} /></span>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[12.5px] font-semibold">{service.name}</b>
                      <span className="text-[11px] text-fg-3">{service.time ?? "Todo el día"}{service.guide ? ` · ${service.guide}` : ""}{service.driver ? ` · ${service.driver}` : ""}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      {trip.chat.length > 0 && (
        <div className="mt-4">
          <p className="mb-1.5 text-[12px] font-semibold text-fg-2">Chat con la agencia</p>
          <ul className="flex flex-col gap-1.5">
            {trip.chat.slice(-3).map((message, index) => (
              <li key={index} className={cn("max-w-[85%] rounded-2xl px-3 py-2 text-[12px]", message.from === "passenger" ? "self-end rounded-br-md bg-accent text-white" : "self-start rounded-bl-md bg-surface-2")}>
                {message.from !== "passenger" && message.sender && <b className="block text-[11px] font-semibold text-accent">{message.sender}</b>}
                {message.body}
              </li>
            ))}
          </ul>
        </div>
      )}
    </PhoneFrame>
  );
}

export function PassengerSide({ trip }: { trip: PassengerTrip }) {
  const services = trip.itinerary.flatMap((day) => day.services);
  const confirmed = services.filter((service) => ["confirmado", "completado"].includes(service.status)).length;
  return (
    <div className="flex flex-col gap-5">
      <section className="grid gap-3 sm:grid-cols-2">
        <TintTile icon={CalendarCheck2} tone="t1" label="Servicios confirmados" value={`${confirmed} de ${services.length}`} note={trip.day ? `Hoy es el día ${trip.day}` : formatDate(trip.from)} />
        <TintTile icon={FileText} tone="t4" label="Vouchers disponibles" value={trip.vouchers.length} note="Los descarga desde la app" />
        <TintTile icon={BellRing} tone="warn" label="Alertas activas" value={trip.alerts.length} note={trip.alerts.length ? "Esperan confirmación de lectura" : "Sin avisos"} />
        <TintTile icon={MessageCircle} tone="violet" label="Mensajes en el chat" value={trip.chat.length} note={trip.chat.length ? `Último ${formatDateTime(trip.chat[trip.chat.length - 1].at, false)}` : "Sin conversación"} />
      </section>
      <Card>
        <TintCardTitle icon={MapIcon} title="Itinerario completo" aside={`${trip.itinerary.length} días`} />
        <ol className="flex flex-col gap-3">
          {trip.itinerary.map((day) => (
            <li key={day.date}>
              <p className="mb-1 text-[12.5px] font-semibold text-fg-2">Día {day.day} · {formatDate(day.date, "long")}</p>
              <ul className="flex flex-col gap-1">
                {day.services.map((service) => (
                  <li key={service.code} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-2">
                    <span className="min-w-0 truncate text-[13px]">
                      <span className="mr-2 font-mono text-[12px] text-fg-3">{service.time ?? "—"}</span>
                      {service.name}
                      <span className="ml-1.5 text-[11.5px] text-fg-3">{SERVICE_KINDS[service.kind] ?? service.kind}</span>
                    </span>
                    <ChannelBadge status={service.status} />
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </Card>
      <Card>
        <TintCardTitle icon={Users} title="Pasajeros" aside={`${trip.passengers.length}`} />
        <ul className="flex flex-wrap gap-2">
          {trip.passengers.map((passenger) => (
            <li key={passenger.name} className="lift rounded-lg border border-line px-2.5 py-1.5 text-[12.5px]">
              {passenger.name}
              {passenger.lead && <span className="ml-1.5 text-[11px] font-semibold text-accent">Titular</span>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
