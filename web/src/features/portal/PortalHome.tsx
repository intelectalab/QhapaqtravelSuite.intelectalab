import { ArrowRight, BellRing, CalendarHeart, Clock, FileText, Moon, Plane, ScrollText, Users, Wallet } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { RichText } from "@/components/ui/RichText";
import { HeroBand, HeroChip, HeroPanel, TintTile, ToneScope } from "@/components/ui/Tinted";
import { MoneyLines } from "@/features/channels/ChannelUi";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import { countdownLabel, type PortalHome as Home, type PortalSession } from "@/lib/portal";
import { AdvisorCard, AlertList, EmptyLine, PortalBadge, RISE, rise, SectionCard, TripCard } from "./PortalUi";

function Countdown({ trip }: { trip: NonNullable<Home["next_trip"]> }) {
  const pct = trip.services ? Math.round((trip.confirmed / trip.services) * 100) : 0;
  const inTrip = trip.day_number !== null;
  return (
    <ToneScope tone={inTrip ? "t4" : "t1"}>
      <HeroBand className="mb-0">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-white/75">{inTrip ? "Estás de viaje" : "Tu próximo viaje"}</p>
            <h2 className="mt-1 text-[24px] font-bold leading-tight tracking-tight sm:text-[30px]">{trip.title}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <HeroChip icon={<Plane size={14} />}>
                {formatDate(trip.from)} – {formatDate(trip.to)}
              </HeroChip>
              <HeroChip icon={<Moon size={14} />}>
                {trip.nights} {trip.nights === 1 ? "noche" : "noches"}
              </HeroChip>
              <HeroChip icon={<Users size={14} />}>
                {trip.passengers} {trip.passengers === 1 ? "pasajero" : "pasajeros"}
              </HeroChip>
            </div>
            {trip.next_service && (
              <p className="mt-4 flex items-center gap-2 text-[13.5px] text-white/85">
                <Clock size={15} /> Siguiente: <b className="font-semibold text-white">{trip.next_service.name}</b> · {formatDate(trip.next_service.service_date)}
                {trip.next_service.service_time ? ` · ${trip.next_service.service_time.slice(0, 5)}` : ""}
              </p>
            )}
            <Link href={`/portal/viajes/${trip.code}`} className="mt-5 inline-flex h-10 items-center gap-2 rounded-control bg-white px-4 text-[13.5px] font-semibold text-[var(--tint)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-12px_rgb(0_0_0/0.45)]">
              Ver itinerario <ArrowRight size={15} />
            </Link>
          </div>
          <HeroPanel solid>
            <p className="text-[12.5px] font-semibold text-fg-3">{inTrip ? `Día ${trip.day_number} de ${trip.nights + 1}` : "Cuenta regresiva"}</p>
            <p className="mt-1 text-[40px] font-bold leading-none tracking-tight text-[var(--tint)]">{inTrip ? `Día ${trip.day_number}` : trip.days_left}</p>
            <p className="mt-1 text-[13px] text-fg-2">{inTrip ? "Disfruta cada momento" : countdownLabel(trip.days_left)}</p>
            <div className="mt-4">
              <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
                <span className="font-semibold">Servicios confirmados</span>
                <span className="text-fg-3">
                  {trip.confirmed} de {trip.services}
                </span>
              </div>
              <span className="block h-2 w-full overflow-hidden rounded-full bg-surface-2">
                <span className="block h-full origin-left rounded-full bg-[var(--tint)] motion-safe:animate-[fill-x_900ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ width: `${Math.max(4, pct)}%` }} />
              </span>
              <div className="mt-2">
                <PortalBadge status={trip.status} scope="trip" />
              </div>
            </div>
          </HeroPanel>
        </div>
      </HeroBand>
    </ToneScope>
  );
}

export function PortalHomeView({ home, session }: { home: Home; session: PortalSession }) {
  const firstName = session.client.name.split(" ")[0];
  const customer = session.role === "customer";
  return (
    <div className="flex flex-col gap-6">
      <div className={RISE}>
        <h1 className="text-[26px] font-bold leading-tight tracking-tight sm:text-[30px]">Hola, {firstName}</h1>
        <p className="mt-1 text-[14px] text-fg-2">{home.next_trip ? "Aquí tienes todo lo de tu viaje en un solo lugar." : "Cuando reserves tu próximo viaje lo verás aquí."}</p>
      </div>

      {home.banners.length > 0 && (
        <div className={cn("grid gap-3", home.banners.length > 1 && "md:grid-cols-2")}>
          {home.banners.slice(0, 2).map((banner, index) => (
            <section key={banner.code} style={rise(index)} className={cn("lift relative overflow-hidden rounded-card border border-line bg-[color-mix(in_srgb,var(--t1)_7%,var(--surface))] px-5 py-4", RISE)}>
              <span aria-hidden className="weave-line absolute inset-x-0 top-0 h-[3px]" />
              <b className="block text-[15px] font-semibold tracking-tight">{banner.title}</b>
              <RichText body={banner.body} size="sm" className="mt-1 line-clamp-3 text-fg-2" />
            </section>
          ))}
        </div>
      )}

      {home.next_trip ? (
        <Countdown trip={home.next_trip} />
      ) : (
        <Card>
          <EmptyLine>No tienes viajes próximos. Tu asesor puede ayudarte a planear el siguiente.</EmptyLine>
        </Card>
      )}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TintTile icon={CalendarHeart} tone="t1" label={customer ? "Mis viajes" : "Mi viaje"} value={home.trips.length} note={home.next_trip ? countdownLabel(home.next_trip.days_left) : "Sin viajes próximos"} />
        {customer && <TintTile icon={ScrollText} tone="violet" label="Propuestas por responder" value={home.quotes.length} note={home.quotes.length ? "Revisa y decide" : "Nada pendiente"} />}
        {customer && <TintTile icon={Wallet} tone="t2" label="Saldo pendiente" value={<MoneyLines values={home.balance} empty="Al día" />} note="Puedes pagar en partes" />}
        <TintTile icon={FileText} tone="t4" label="Vouchers" value={home.documents} note={home.documents ? "Listos para tu viaje" : "Llegan al confirmar"} />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5">
          <SectionCard icon={BellRing} title="Pendientes" aside={home.alerts.length || undefined}>
            <AlertList alerts={home.alerts} />
          </SectionCard>
          {customer && home.quotes.length > 0 && (
            <SectionCard icon={ScrollText} title="Propuestas para ti">
              <ul className="flex flex-col gap-2">
                {home.quotes.map((quote, index) => (
                  <li key={quote.code} style={rise(index)} className={RISE}>
                    <Link href={`/portal/propuestas/${quote.code}`} className="lift flex items-center justify-between gap-3 rounded-tile border border-line bg-surface px-3.5 py-3">
                      <span className="min-w-0">
                        <b className="block truncate text-[13.5px] font-semibold">{quote.title}</b>
                        <span className="text-[12px] text-fg-3">{quote.valid_until ? `Válida hasta el ${formatDate(quote.valid_until)}` : quote.code}</span>
                      </span>
                      <span className="flex flex-none flex-col items-end gap-1">
                        {quote.total !== null && <b className="text-[13.5px]">{formatMoney(quote.total, quote.currency)}</b>}
                        <PortalBadge status={quote.status} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}
          {customer && (
            <SectionCard icon={CalendarHeart} title="Mis viajes" aside={<Link href="/portal/viajes" className="text-t1">Ver todos</Link>}>
              {home.trips.length === 0 ? (
                <EmptyLine>Aún no tienes viajes reservados.</EmptyLine>
              ) : (
                <ul className="grid gap-3 md:grid-cols-2">
                  {home.trips.slice(0, 4).map((trip, index) => (
                    <TripCard key={trip.code} trip={trip} index={index} />
                  ))}
                </ul>
              )}
            </SectionCard>
          )}
        </div>
        <AdvisorCard advisor={home.advisor} />
      </div>
    </div>
  );
}
