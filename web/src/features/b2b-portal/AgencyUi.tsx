import { AlarmClock, ArrowRight, BadgePercent, CalendarDays, Clock, CreditCard, Lock, MapPin, Ticket, UserRoundPen, Users, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { InfoTip } from "@/components/ui/InfoTip";
import { EmptyLine, RISE, rise } from "@/features/portal/PortalUi";
import { agencyStatus, creditTone, type AgencyAlert, type AgencyCredit, type CatalogCard } from "@/lib/b2b-portal";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import type { PortalStatusScope } from "@/lib/portal";
import { toneStyle } from "@/lib/tone";

export function AgencyBadge({ status, scope }: { status: string; scope?: PortalStatusScope }) {
  const meta = agencyStatus(status, scope);
  return <Badge tone={meta.tone}>{meta.label}</Badge>;
}

export function CreditMeter({ credit, compact = false }: { credit: AgencyCredit; compact?: boolean }) {
  const tone = creditTone(credit.pct, credit.status);
  const pct = Math.min(100, credit.pct ?? 0);
  if (credit.limit <= 0) {
    return (
      <div style={toneStyle("mute")} className="rounded-tile border border-dashed border-line px-4 py-3 text-[13px] text-fg-2">
        Tu convenio trabaja solo con prepago. Pide a tu ejecutivo una línea de crédito para reservar sin pagar por adelantado.
      </div>
    );
  }
  return (
    <div style={toneStyle(tone)} className="group">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[12.5px] font-medium text-fg-2">Crédito disponible</p>
          <p className={cn("font-bold tracking-tight text-[var(--tint)]", compact ? "text-[22px]" : "text-[30px] leading-none")}>{formatMoney(credit.available, credit.currency)}</p>
        </div>
        <p className="text-right text-[12.5px] text-fg-3">
          Usado <b className="text-fg">{formatMoney(credit.used, credit.currency)}</b>
          <br />
          de {formatMoney(credit.limit, credit.currency)}
        </p>
      </div>
      <div className="relative mt-3 h-3 w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--tint)_12%,var(--surface-2))]" title={`${credit.pct ?? 0} % de la línea utilizada`}>
        <span className="absolute inset-y-0 left-0 rounded-full bg-[var(--tint)] transition-[filter] duration-300 group-hover:brightness-110 motion-safe:animate-[fill-x_1100ms_cubic-bezier(0.22,1,0.36,1)_backwards] origin-left" style={{ width: `${Math.max(2, pct)}%` }} />
        <span aria-hidden className="absolute inset-y-0 w-px bg-[color-mix(in_srgb,var(--fg)_35%,transparent)]" style={{ left: "80%" }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[11.5px] text-fg-3">
        <span>{credit.pct ?? 0} % usado</span>
        <span>Alerta al 80 %</span>
      </div>
      {credit.block && <p className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-bad"><Lock size={13} /> {credit.block}</p>}
    </div>
  );
}

const ALERT_ICONS: Record<AgencyAlert["kind"], LucideIcon> = { block: Lock, credit: CreditCard, payment: AlarmClock, names: UserRoundPen };

export function AgencyAlerts({ alerts }: { alerts: AgencyAlert[] }) {
  if (alerts.length === 0) return <EmptyLine>Todo en orden: sin cuotas por vencer ni bloqueos.</EmptyLine>;
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
                <span className="block text-[12.5px] text-fg-2">{alert.detail}</span>
              </span>
              <span className="flex flex-none flex-col items-end text-right">
                {alert.amount !== null && alert.currency && <b className="text-[13.5px]">{formatMoney(alert.amount, alert.currency)}</b>}
                {alert.date && <span className="text-[12px] text-fg-3">{formatDate(alert.date)}</span>}
              </span>
              <ArrowRight size={16} className="flex-none text-fg-3 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function ProductCard({ product, index }: { product: CatalogCard; index: number }) {
  const tone = product.bookable ? "t3" : "mute";
  return (
    <li style={{ ...toneStyle(tone), ...rise(index) }} className={RISE}>
      <Link href={`/agencia/catalogo/${product.code}`} className={cn("lift group relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card", !product.bookable && "opacity-80")}>
        <div className="relative h-36 overflow-hidden bg-[color-mix(in_srgb,var(--tint)_14%,var(--surface-2))]">
          {product.image ? (
            <span aria-hidden className="absolute inset-0 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style={{ backgroundImage: `url(${product.image})` }} />
          ) : (
            <span aria-hidden className="weave-pattern absolute inset-0 bg-[length:22px_22px] opacity-[0.22] transition-[background-position] duration-700 group-hover:bg-[position:11px_11px]" />
          )}
          <span className="absolute left-3 top-3 rounded-full bg-surface/90 px-2.5 py-1 text-[11.5px] font-semibold text-fg-2 backdrop-blur">{product.type.toLowerCase().replace(/^./, (c) => c.toUpperCase())}</span>
          {product.commission_pct !== null && product.bookable && (
            <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-[var(--tint)] px-2.5 py-1 text-[11.5px] font-bold text-white shadow-[0_6px_14px_-8px_var(--tint)]">
              <BadgePercent size={12} /> {product.commission_pct} %
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-3 p-4">
          <div>
            <b className="block text-[15px] font-semibold leading-snug transition-colors group-hover:text-[var(--tint)]">{product.name}</b>
            <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-fg-3">
              {product.destination && (
                <span className="flex items-center gap-1">
                  <MapPin size={12} /> {product.destination}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Clock size={12} /> {product.duration}
              </span>
              <span className="flex items-center gap-1">
                <Users size={12} /> {product.pax.min}–{product.pax.max}
              </span>
            </span>
          </div>
          {product.bookable && product.net !== null && product.currency ? (
            <div className="grid grid-cols-3 gap-2 rounded-tile bg-surface-2 p-2.5 text-center">
              <PriceCell label="Neto" value={formatMoney(product.net, product.currency)} strong />
              <PriceCell label="PVP sugerido" value={product.pvp !== null ? formatMoney(product.pvp, product.currency) : "—"} />
              <PriceCell label="Comisión" value={product.commission !== null ? formatMoney(product.commission, product.currency) : "—"} />
            </div>
          ) : (
            <p className="flex items-start gap-1.5 rounded-tile border border-dashed border-line px-3 py-2.5 text-[12.5px] text-fg-3">
              <Lock size={13} className="mt-0.5 flex-none" /> {product.reason}
            </p>
          )}
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 text-[12px]">
            {product.next_date ? (
              <span className="flex items-center gap-1.5 text-fg-2">
                <CalendarDays size={13} /> Próxima fecha {formatDate(product.next_date)}
              </span>
            ) : (
              <span className="text-fg-3">{product.bookable ? "Consulta fechas" : "No reservable"}</span>
            )}
            <span className="flex items-center gap-1.5">
              {product.credit ? <Badge tone="ok">Crédito</Badge> : product.bookable && <Badge tone="warn">Solo prepago</Badge>}
            </span>
          </div>
          {product.departures.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {product.departures.map((departure) => (
                <span key={departure.date} className="flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11.5px] text-fg-2 transition group-hover:border-[color-mix(in_srgb,var(--tint)_40%,transparent)]">
                  <Ticket size={11} /> {formatDate(departure.date)} · {departure.spots} cupos
                </span>
              ))}
            </div>
          )}
        </div>
      </Link>
    </li>
  );
}

function PriceCell({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <span className="min-w-0">
      <span className="block text-[11px] text-fg-3">{label}</span>
      <b className={cn("block truncate text-[13px]", strong ? "text-[var(--tint)]" : "text-fg")}>{value}</b>
    </span>
  );
}

export function NetInfo() {
  return <InfoTip label="Qué es la tarifa neta">La tarifa neta es lo que tu agencia paga por pasajero. El PVP es el precio de venta sugerido al público; la diferencia es tu margen. La comisión se calcula sobre el total neto y se liquida aparte.</InfoTip>;
}
