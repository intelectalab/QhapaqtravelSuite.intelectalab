import { ArrowRight, BadgePercent, BellRing, CalendarRange, HandCoins, Package, PlaneTakeoff, TrendingUp, UserRoundPen, Users } from "lucide-react";
import Link from "next/link";
import { BarChart } from "@/components/ui/Charts";
import { HeroBand, HeroChip, HeroPanel, TintTile, ToneScope } from "@/components/ui/Tinted";
import { MoneyLines } from "@/features/channels/ChannelUi";
import { EmptyLine, RISE, rise, SectionCard } from "@/features/portal/PortalUi";
import { conventionStatus, type AgencyHome as Home, type AgencySession } from "@/lib/b2b-portal";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { AgencyAlerts, AgencyBadge, CreditMeter, ProductCard } from "./AgencyUi";

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function countdown(days: number): string {
  if (days > 1) return `en ${days} días`;
  if (days === 1) return "mañana";
  if (days === 0) return "hoy";
  return "en viaje";
}

export function AgencyHomeView({ home, session }: { home: Home; session: AgencySession }) {
  const status = conventionStatus(home.credit.status);
  return (
    <div className="flex flex-col gap-6">
      <div className={RISE}>
        <h1 className="text-[26px] font-bold leading-tight tracking-tight sm:text-[30px]">Hola, {session.user.name.replace(/^Agencia\s+/i, "").replace(/\s*\(B2B\)$/i, "")}</h1>
        <p className="mt-1 text-[14px] text-fg-2">Tu línea de crédito, tus salidas y lo que necesita atención hoy.</p>
      </div>

      <ToneScope tone="t3">
        <HeroBand className="mb-0">
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-center">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-white/75">Convenio {session.agency.code}</p>
              <h2 className="mt-1 text-[24px] font-bold leading-tight tracking-tight sm:text-[30px]">{session.agency.name}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <HeroChip icon={<BadgePercent size={14} />}>Comisión base {home.credit.commission_pct} %</HeroChip>
                <HeroChip icon={<CalendarRange size={14} />}>Vigente hasta {formatDate(session.agency.valid_to)}</HeroChip>
                <HeroChip>{status.label}</HeroChip>
              </div>
              <Link
                href="/agencia/catalogo"
                className={cn(
                  "mt-5 inline-flex h-10 items-center gap-2 rounded-control bg-white px-4 text-[13.5px] font-semibold text-[var(--tint)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-12px_rgb(0_0_0/0.45)]",
                  !home.credit.can_book && "pointer-events-none opacity-60",
                )}
              >
                Cotizar y reservar <ArrowRight size={15} />
              </Link>
            </div>
            <HeroPanel solid>
              <CreditMeter credit={home.credit} />
            </HeroPanel>
          </div>
        </HeroBand>
      </ToneScope>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TintTile icon={PlaneTakeoff} tone="t1" label="Reservas activas" value={home.active} note={`${home.bookings_month} creadas este mes`} />
        <TintTile icon={TrendingUp} tone="t4" label="Ventas netas del mes" value={<MoneyLines values={home.sales_month} empty="Sin ventas aún" />} note="Total neto reservado" />
        <TintTile icon={BadgePercent} tone="violet" label="Comisión del mes" value={<MoneyLines values={home.commission_month} empty="—" />} note="Calculada sobre el neto" />
        <TintTile icon={HandCoins} tone="t2" label="Comisión por liquidar" value={<MoneyLines values={home.commission_pending} empty="Nada pendiente" />} note="Solicítala en estado de cuenta" />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-5">
          <SectionCard icon={BellRing} title="Requiere atención" aside={home.alerts.length || undefined}>
            <AgencyAlerts alerts={home.alerts} />
          </SectionCard>
          <SectionCard icon={PlaneTakeoff} title="Próximas salidas de tus pasajeros" aside={<Link href="/agencia/reservas" className="text-t3">Ver todas</Link>}>
            {home.upcoming.length === 0 ? (
              <EmptyLine>No tienes salidas próximas. Reserva desde el catálogo.</EmptyLine>
            ) : (
              <ul className="flex flex-col gap-2">
                {home.upcoming.map((row, index) => (
                  <li key={row.code} style={rise(index)} className={RISE}>
                    <Link href={`/agencia/reservas/${row.code}`} className="lift group flex items-center gap-3 rounded-tile border border-line bg-surface px-3.5 py-3">
                      <span className="grid w-12 flex-none place-items-center rounded-[10px] bg-[color-mix(in_srgb,var(--t3)_12%,var(--surface))] py-1.5 text-center text-t3 transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-105">
                        <b className="text-[17px] leading-none">{row.from.slice(8, 10)}</b>
                        <span className="text-[11px] font-semibold">{MONTHS[Number(row.from.slice(5, 7)) - 1]}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[13.5px] font-semibold">{row.title}</b>
                        <span className="flex flex-wrap items-center gap-x-3 text-[12px] text-fg-3">
                          <span>Sale {countdown(row.days_left)}</span>
                          <span className="flex items-center gap-1">
                            <Users size={12} /> {row.pax}
                          </span>
                          {row.reference && <span>Ref. {row.reference}</span>}
                          {row.pending_names > 0 && (
                            <span className="flex items-center gap-1 font-semibold text-info">
                              <UserRoundPen size={12} /> {row.pending_names} por nominar
                            </span>
                          )}
                        </span>
                      </span>
                      <AgencyBadge status={row.status} />
                      <ArrowRight size={16} className="flex-none text-fg-3 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
        <div className="flex flex-col gap-5">
          <SectionCard icon={TrendingUp} title="Reservas por mes">
            <BarChart data={home.trend.map((item, index) => ({ label: MONTHS[Number(item.month.slice(5, 7)) - 1], value: item.count, caption: `${item.count} ${item.count === 1 ? "reserva" : "reservas"}`, highlight: index === home.trend.length - 1 }))} />
          </SectionCard>
          <SectionCard icon={Package} title="Para vender hoy" aside={<Link href="/agencia/catalogo" className="text-t3">Catálogo</Link>}>
            {home.catalog.length === 0 ? (
              <EmptyLine>Aún no tienes productos con tarifa asignada.</EmptyLine>
            ) : (
              <ul className="flex flex-col gap-3">
                {home.catalog.slice(0, 2).map((product, index) => (
                  <ProductCard key={product.code} product={product} index={index} />
                ))}
              </ul>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
