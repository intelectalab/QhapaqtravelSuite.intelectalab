import { ArrowRight, CalendarDays, FileWarning, Mail, Phone, ScrollText, Users, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { TintCardTitle } from "@/components/ui/Tinted";
import { UsageBar } from "@/features/channels/ChannelUi";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import { PHASES, portalStatus, type PortalAdvisor, type PortalStatusScope, type PortalAlert, type PortalTripSummary } from "@/lib/portal";
import { toneStyle } from "@/lib/tone";

export const RISE = "animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]";

export function rise(index: number) {
  return { animationDelay: `${index * 60}ms` };
}

export function PortalBadge({ status, scope }: { status: string; scope?: PortalStatusScope }) {
  const meta = portalStatus(status, scope);
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function PortalTitle({ title, subtitle, actions, back }: { title: string; subtitle?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className={cn("mb-6 flex flex-wrap items-end justify-between gap-4", RISE)}>
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="group mb-2 inline-flex items-center gap-1 text-[12.5px] font-semibold text-fg-3 transition hover:text-t1">
            <ArrowRight size={13} className="rotate-180 transition-transform group-hover:-translate-x-0.5" />
            {back.label}
          </Link>
        )}
        <h1 className="text-[26px] font-bold leading-tight tracking-tight sm:text-[30px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[14px] text-fg-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionCard({ icon, title, aside, children, className }: { icon: LucideIcon; title: string; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={className}>
      <TintCardTitle icon={icon} title={title} aside={aside} />
      {children}
    </Card>
  );
}

export function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="rounded-tile border border-dashed border-line px-4 py-5 text-center text-[13px] text-fg-3">{children}</p>;
}

export function AdvisorCard({ advisor }: { advisor: PortalAdvisor | null }) {
  return (
    <SectionCard icon={Users} title="Tu asesor de viaje">
      {advisor ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Avatar name={advisor.name} size="md" solid />
            <div className="min-w-0">
              <b className="block truncate text-[14px] font-semibold">{advisor.name}</b>
              <span className="text-[12.5px] text-fg-3">Te acompaña antes, durante y después del viaje</span>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 text-[13px]">
            <a href={`mailto:${advisor.email}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-fg-2 transition hover:bg-surface-2 hover:text-fg">
              <Mail size={14} /> {advisor.email}
            </a>
            {advisor.phone && (
              <a href={`tel:${advisor.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-fg-2 transition hover:bg-surface-2 hover:text-fg">
                <Phone size={14} /> {advisor.phone}
              </a>
            )}
          </div>
          <Link href="/portal/mensajes" className="inline-flex items-center gap-1 text-[13px] font-semibold text-t1">
            Escribirle un mensaje <ArrowRight size={14} />
          </Link>
        </div>
      ) : (
        <p className="text-[13px] text-fg-3">Pronto te asignaremos un asesor.</p>
      )}
    </SectionCard>
  );
}

const ALERT_ICONS: Record<PortalAlert["kind"], LucideIcon> = { payment: Wallet, document: FileWarning, quote: ScrollText };

export function AlertList({ alerts }: { alerts: PortalAlert[] }) {
  if (alerts.length === 0) return <EmptyLine>Todo en orden. No tienes pendientes por ahora.</EmptyLine>;
  return (
    <ul className="flex flex-col gap-2">
      {alerts.map((alert, index) => {
        const Icon = ALERT_ICONS[alert.kind];
        return (
          <li key={`${alert.kind}-${alert.href}-${index}`} style={{ ...toneStyle(alert.tone), ...rise(index) }} className={RISE}>
            <Link href={alert.href} className="lift group flex items-center gap-3 rounded-tile border border-[color-mix(in_srgb,var(--tint)_25%,transparent)] bg-[color-mix(in_srgb,var(--tint)_7%,var(--surface))] px-3.5 py-3">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-[var(--tint)] text-white transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
                <Icon size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <b className="block text-[13.5px] font-semibold text-[var(--tint)]">{alert.title}</b>
                <span className="block truncate text-[12.5px] text-fg-2">{alert.detail}</span>
              </span>
              <span className="flex flex-none flex-col items-end text-right">
                {alert.amount !== null && alert.currency && <b className="text-[13.5px]">{formatMoney(alert.amount, alert.currency)}</b>}
                {alert.date && <span className="text-[12px] text-fg-3">{alert.kind === "quote" ? "Vence" : alert.kind === "document" ? "Viaje" : "Vence"} {formatDate(alert.date)}</span>}
              </span>
              <ArrowRight size={16} className="flex-none text-fg-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function TripCard({ trip, index }: { trip: PortalTripSummary; index: number }) {
  const phase = trip.phase ? PHASES[trip.phase] : null;
  const pct = trip.services ? (trip.confirmed / trip.services) * 100 : 0;
  return (
    <li style={rise(index)} className={RISE}>
      <Link href={`/portal/viajes/${trip.code}`} style={toneStyle(phase?.tone ?? "t1")} className="lift group relative flex h-full flex-col gap-3 overflow-hidden rounded-card border border-line bg-surface p-4 shadow-card">
        <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-[var(--tint)] transition-[height] duration-300 group-hover:h-1.5" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <b className="block text-[15px] font-semibold leading-snug">{trip.title}</b>
            <span className="mt-1 flex items-center gap-1.5 text-[12.5px] text-fg-3">
              <CalendarDays size={13} /> {formatDate(trip.from)} – {formatDate(trip.to)}
            </span>
          </div>
          <PortalBadge status={trip.status} scope="trip" />
        </div>
        <div className="flex items-center gap-2" title={`${trip.confirmed} de ${trip.services} servicios confirmados`}>
          <UsageBar pct={pct} tone="ok" />
          <span className="flex-none text-[12px] text-fg-3">
            {trip.confirmed}/{trip.services} confirmados
          </span>
        </div>
        <div className="mt-auto flex items-center justify-between text-[12.5px] text-fg-2">
          <span className="flex items-center gap-1.5">
            <Users size={13} /> {trip.passengers} {trip.passengers === 1 ? "pasajero" : "pasajeros"}
          </span>
          {trip.total !== null ? <b className="text-[13.5px] text-fg">{formatMoney(trip.total, trip.currency)}</b> : phase && <span className="font-semibold text-[var(--tint)]">{phase.label}</span>}
        </div>
      </Link>
    </li>
  );
}
