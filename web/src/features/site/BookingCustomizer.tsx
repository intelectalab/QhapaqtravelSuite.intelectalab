"use client";

import { BedDouble, Check, Compass, MapPin, Plane, Route, Sparkles, Ticket } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import type { BookingConfig, BookingExtras, BookingHotel, LodgingChoice, TripConfig, TripTransport } from "@/lib/site";
import { SectionHeading } from "./Bits";
import { useBooking } from "./ProductBooking";
import { Stepper } from "./SearchBar";
import { useSite } from "./SiteContext";

function hasCustomization(config: BookingConfig | undefined): config is BookingConfig {
  return Boolean(config && (config.options.length > 0 || config.addons.length > 0 || config.lodging || config.pickup || config.trip));
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function schedule(trip: TripConfig, date: string | null, nights: Record<string, number>): Record<string, { nights: number; check_in: string | null; check_out: string | null }> {
  const out: Record<string, { nights: number; check_in: string | null; check_out: string | null }> = {};
  let day = date;
  for (const leg of trip.legs) {
    const count = Math.max(leg.min_nights, Math.min(leg.max_nights, nights[leg.id] ?? leg.nights));
    out[leg.id] = { nights: count, check_in: day, check_out: day ? addDays(day, count) : null };
    day = day ? addDays(day, count) : null;
  }
  return out;
}

function vehicleFor(option: TripTransport, people: number) {
  const sorted = [...option.vehicles].sort((a, b) => a.max_pax - b.max_pax);
  return sorted.find((vehicle) => vehicle.max_pax >= people) ?? sorted[sorted.length - 1];
}

function Block({ icon, title, hint, children, index }: { icon: ReactNode; title: string; hint?: string; children: ReactNode; index: number }) {
  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ animationDelay: `${index * 60}ms` }}>
      <header className="mb-4 flex items-start gap-3">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[color-mix(in_srgb,var(--t1)_10%,transparent)] text-t1">{icon}</span>
        <span className="min-w-0">
          <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
          {hint && <p className="text-[12.5px] text-fg-3">{hint}</p>}
        </span>
      </header>
      {children}
    </section>
  );
}

function Toggle({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={active} onClick={onClick} className={cn("lift relative rounded-2xl border p-3.5 text-left transition", active ? "border-accent bg-[color-mix(in_srgb,var(--accent)_7%,var(--surface))]" : "border-line bg-surface hover:border-[color-mix(in_srgb,var(--accent)_45%,transparent)]", className)}>
      <span className={cn("absolute right-3 top-3 grid h-5 w-5 place-items-center rounded-full border transition", active ? "border-accent bg-accent text-white" : "border-line text-transparent")}>
        <Check size={12} />
      </span>
      {children}
    </button>
  );
}

function cheapest(hotel: BookingHotel): number {
  return Math.min(...hotel.rooms.map((room) => Number(room.price)));
}

export function BookingCustomizer({ heading = false }: { heading?: boolean }) {
  const { t, dateLocale } = useSite();
  const { config, extras, setExtras, pax, product, date } = useBooking();
  if (!hasCustomization(config)) return null;
  const seats = pax.adults + pax.children;
  const update = (patch: Partial<BookingExtras>) => setExtras({ ...extras, ...patch });
  const lodging = config.lodging;
  const trip = config.trip ?? null;
  const nights = extras.nights ?? {};
  const plan = trip ? schedule(trip, date, nights) : {};
  const tripLeg = (legId: string) => trip?.legs.find((leg) => leg.id === legId);
  const setNights = (legId: string, value: number) => update({ nights: { ...nights, [legId]: value } });
  const tours = extras.tours ?? [];
  const transport = extras.transport ?? [];
  const toggleTour = (id: string) => update(tours.includes(id) ? { tours: tours.filter((item) => item !== id), removed: extras.removed.filter((key) => key !== `tour-${id}`) } : { tours: [...tours, id] });
  const toggleTransport = (option: TripTransport, group: TripTransport[]) => {
    const same = option.to_leg_id ? group.map((item) => item.id) : [option.id];
    const had = transport.includes(option.id);
    update({ transport: [...transport.filter((id) => !same.includes(id)), ...(had ? [] : [option.id])], removed: extras.removed.filter((key) => !same.some((id) => key === `trans-${id}`)) });
  };
  const optionPrice = (option: TripTransport) => {
    if (option.pricing === "vehiculo") {
      const vehicle = vehicleFor(option, seats);
      return vehicle ? `${formatMoney(vehicle.price, option.currency)} ${t.booking.trip.perVehicle(vehicle.name)}` : "";
    }
    return `${formatMoney(option.price_adult ?? 0, option.currency)} ${t.booking.trip.adult}`;
  };
  const lastLeg = trip ? plan[trip.legs[trip.legs.length - 1]?.id ?? ""] : undefined;
  const choiceFor = (legId: string): LodgingChoice | undefined => extras.lodging.find((choice) => choice.leg_id === legId);
  const setChoice = (legId: string, choice: LodgingChoice | null) => {
    const others = extras.lodging.filter((item) => item.leg_id !== legId);
    const next = choice ? [...others, choice] : others;
    const order = lodging?.legs.map((leg) => leg.id) ?? [];
    update({ lodging: next.sort((a, b) => order.indexOf(a.leg_id) - order.indexOf(b.leg_id)), removed: extras.removed.filter((key) => !key.startsWith(`lodge-${legId}-`)) });
  };
  const pickHotel = (legId: string, hotel: BookingHotel) => {
    const room = [...hotel.rooms].filter((item) => item.capacity >= 2).sort((a, b) => Number(a.price) - Number(b.price))[0] ?? hotel.rooms[0];
    setChoice(legId, { leg_id: legId, hotel_id: hotel.id, rooms: room ? [{ type: room.type, qty: Math.max(1, Math.ceil(seats / room.capacity)) }] : [] });
  };
  const setRooms = (legId: string, choice: LodgingChoice, type: string, qty: number) => {
    const rooms = [...choice.rooms.filter((room) => room.type !== type), ...(qty > 0 ? [{ type, qty }] : [])];
    setChoice(legId, rooms.length > 0 ? { ...choice, rooms } : null);
  };
  const addonOn = (id: string) => extras.addons.some((addon) => addon.id === id);
  const toggleAddon = (id: string) => update(addonOn(id) ? { addons: extras.addons.filter((addon) => addon.id !== id), removed: extras.removed.filter((key) => key !== `addon-${id}`) } : { addons: [...extras.addons, { id }] });
  let index = 0;

  return (
    <section id="personalizar" className="grid scroll-mt-24 gap-4">
      {heading && <SectionHeading eyebrow={t.booking.extrasTotal} title={t.booking.customize} description={t.booking.customizeHint} className="mb-1" />}
      {config.options.length > 0 && (
        <Block icon={<Sparkles size={17} />} title={t.booking.options} index={index++}>
          <div className="grid gap-4">
            {config.options.map((group) => {
              const picked = extras.options.find((option) => option.group === group.group)?.label;
              return (
                <div key={group.group}>
                  <p className="mb-2 text-[12.5px] font-semibold text-fg-2">{group.group}</p>
                  <div role="radiogroup" aria-label={group.group} className="flex flex-wrap gap-2">
                    {group.options.map((option) => (
                      <button key={option.label} type="button" role="radio" aria-checked={picked === option.label} onClick={() => update({ options: [...extras.options.filter((item) => item.group !== group.group), { group: group.group, label: option.label }] })} className={cn("rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition", picked === option.label ? "border-accent bg-accent text-white" : "border-line text-fg-2 hover:border-accent hover:text-accent")}>
                        {option.label}
                        {Number(option.delta) !== 0 && <span className="ml-1.5 font-medium opacity-80">{Number(option.delta) > 0 ? "+ " : "− "}{formatMoney(Math.abs(Number(option.delta)), product.from?.currency ?? "PEN")}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Block>
      )}

      {lodging && (
        <Block icon={<BedDouble size={17} />} title={t.booking.lodging} hint={t.booking.lodgingHint(lodging.legs.length, trip ? Object.values(plan).reduce((sum, leg) => sum + leg.nights, 0) : lodging.nights)} index={index++}>
          {lodging.optional && (
            <div role="radiogroup" aria-label={t.booking.lodging} className="mb-4 inline-flex rounded-full border border-line p-1">
              {[false, true].map((none) => (
                <button key={String(none)} type="button" role="radio" aria-checked={extras.no_lodging === none} onClick={() => update(none ? { no_lodging: true, lodging: [] } : { no_lodging: false, lodging: lodging.legs.flatMap((leg) => { const hotel = [...leg.hotels].sort((a, b) => cheapest(a) - cheapest(b))[0]; const room = hotel?.rooms.filter((item) => item.capacity >= 2).sort((a, b) => Number(a.price) - Number(b.price))[0]; return hotel && room ? [{ leg_id: leg.id, hotel_id: hotel.id, rooms: [{ type: room.type, qty: Math.max(1, Math.ceil(seats / room.capacity)) }] }] : []; }) })} className={cn("rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition", extras.no_lodging === none ? "bg-accent text-white" : "text-fg-2 hover:text-accent")}>
                  {none ? t.booking.noLodging : t.booking.withLodging}
                </button>
              ))}
            </div>
          )}
          {!extras.no_lodging && (
            <ol className="relative grid gap-4 border-l-2 border-dashed border-line pl-5">
              {lodging.legs.map((leg) => {
                const choice = choiceFor(leg.id);
                const hotel = leg.hotels.find((item) => item.id === choice?.hotel_id);
                return (
                  <li key={leg.id} className="relative">
                    <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-surface bg-t1" />
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0">
                        <b className="text-[14px] font-semibold text-fg">{leg.city}</b>
                        {plan[leg.id]?.check_in && (
                          <span className="ml-2 text-[12px] text-fg-3">
                            {formatDate(plan[leg.id].check_in ?? "", "short", dateLocale)} → {formatDate(plan[leg.id].check_out ?? "", "short", dateLocale)}
                          </span>
                        )}
                        {tripLeg(leg.id)?.seasonal && <span className="ml-2 rounded-full bg-[color-mix(in_srgb,var(--t3)_14%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-t3">{t.booking.trip.seasonal}</span>}
                      </span>
                      {tripLeg(leg.id) && (tripLeg(leg.id)?.max_nights ?? 0) > (tripLeg(leg.id)?.min_nights ?? 0) ? (
                        <span className="flex items-center gap-2" title={t.booking.trip.nightsRange(tripLeg(leg.id)?.min_nights ?? 1, tripLeg(leg.id)?.max_nights ?? 1)}>
                          <span className="text-[12px] text-fg-3">{t.booking.nights(plan[leg.id]?.nights ?? leg.nights)}</span>
                          <Stepper value={plan[leg.id]?.nights ?? leg.nights} min={tripLeg(leg.id)?.min_nights ?? leg.nights} max={tripLeg(leg.id)?.max_nights ?? leg.nights} onChange={(value) => setNights(leg.id, value)} label={t.booking.nights(plan[leg.id]?.nights ?? leg.nights)} removeLabel={t.booking.trip.lessNights(leg.city)} addLabel={t.booking.trip.moreNights(leg.city)} />
                        </span>
                      ) : (
                        <span className="text-[12px] text-fg-3">{t.booking.nights(plan[leg.id]?.nights ?? leg.nights)}</span>
                      )}
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {leg.hotels.map((item) => (
                        <Toggle key={item.id} active={item.id === hotel?.id} onClick={() => (item.id === hotel?.id && lodging.optional ? setChoice(leg.id, null) : pickHotel(leg.id, item))}>
                          <b className="block pr-6 text-[13.5px] font-semibold leading-snug text-fg">{item.name}</b>
                          <span className="mt-1 flex items-center justify-between gap-2 text-[12px] text-fg-3">
                            {item.category && <span>{item.category}</span>}
                            <span className="tabular-nums">{t.common.from} {formatMoney(cheapest(item), lodging.currency)} {t.booking.perNight}</span>
                          </span>
                        </Toggle>
                      ))}
                    </div>
                    {hotel && choice && (
                      <div className="mt-2 divide-y divide-line rounded-2xl border border-line">
                        {hotel.rooms.map((room) => (
                          <div key={room.type} className="flex items-center justify-between gap-3 px-3.5 py-2">
                            <span className="text-[13px]">
                              <b className="font-semibold text-fg">{room.type}</b>
                              <span className="block text-[11.5px] text-fg-3">{t.booking.upTo(room.capacity)} · {formatMoney(room.price, lodging.currency)} {t.booking.perNight}</span>
                            </span>
                            <Stepper value={choice.rooms.find((item) => item.type === room.type)?.qty ?? 0} min={0} max={10} onChange={(qty) => setRooms(leg.id, choice, room.type, qty)} label={room.type.toLowerCase()} removeLabel={t.common.remove(room.type.toLowerCase())} addLabel={t.common.add(room.type.toLowerCase())} />
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
          {lodging.note && <p className="mt-3 text-[12px] text-fg-3">{lodging.note}</p>}
        </Block>
      )}

      {trip && (
        <Block icon={<Compass size={17} />} title={t.booking.trip.title} hint={t.booking.trip.hint} index={index++}>
          <ol className="grid gap-3">
            {trip.legs.map((leg, position) => {
              const next = trip.legs[position + 1];
              const arrivals = next ? next.arrivals.filter((option) => option.from_leg_id === leg.id) : [];
              if (leg.tours.length === 0 && leg.local.length === 0 && arrivals.length === 0) return null;
              return (
                <li key={leg.id} className="rounded-2xl border border-line p-3.5">
                  <p className="flex flex-wrap items-baseline justify-between gap-2">
                    <b className="text-[14px] font-semibold text-fg">{leg.city}</b>
                    {plan[leg.id]?.check_in && <span className="text-[12px] text-fg-3">{formatDate(plan[leg.id].check_in ?? "", "short", dateLocale)} → {formatDate(plan[leg.id].check_out ?? "", "short", dateLocale)}</span>}
                  </p>
                  {leg.tours.length > 0 && (
                    <>
                      <p className="mb-2 mt-3 text-[12px] font-semibold text-fg-2">{t.booking.trip.tours}</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {leg.tours.map((tour) => (
                          <Toggle key={tour.id} active={tours.includes(tour.id)} onClick={() => toggleTour(tour.id)}>
                            <b className="block pr-6 text-[13.5px] font-semibold leading-snug text-fg">{tour.name}</b>
                            <span className="mt-1 block text-[12px] text-fg-3">
                              {t.booking.trip.day(tour.day_offset)} · {tour.time} · {t.booking.trip.hours(tour.hours)}
                              {tour.min_age ? ` · ${t.booking.trip.minAge(tour.min_age)}` : ""}
                            </span>
                            <span className="mt-1 block text-[12px] tabular-nums text-fg-2">
                              {formatMoney(tour.price_adult, tour.currency)} {t.booking.trip.adult}
                              {Number(tour.price_child) > 0 ? ` · ${formatMoney(tour.price_child, tour.currency)} ${t.booking.trip.child}` : tour.min_age ? ` · ${t.booking.trip.childNA}` : ""}
                            </span>
                          </Toggle>
                        ))}
                      </div>
                    </>
                  )}
                  {leg.local.length > 0 && (
                    <>
                      <p className="mb-2 mt-3 text-[12px] font-semibold text-fg-2">{t.booking.trip.local}</p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {leg.local.map((option) => (
                          <Toggle key={option.id} active={transport.includes(option.id)} onClick={() => toggleTransport(option, leg.local)}>
                            <b className="block pr-6 text-[13.5px] font-semibold leading-snug text-fg">{option.name}</b>
                            <span className="mt-1 block text-[12px] tabular-nums text-fg-3">{optionPrice(option)}</span>
                          </Toggle>
                        ))}
                      </div>
                    </>
                  )}
                  {next && arrivals.length > 0 && (
                    <>
                      <p className="mb-2 mt-3 text-[12px] font-semibold text-fg-2">
                        {t.booking.trip.getTo(next.city)} <span className="font-normal text-fg-3">({t.booking.trip.chooseOne})</span>
                      </p>
                      <div role="radiogroup" aria-label={t.booking.trip.getTo(next.city)} className="grid gap-2 sm:grid-cols-2">
                        {arrivals.map((option) => (
                          <Toggle key={option.id} active={transport.includes(option.id)} onClick={() => toggleTransport(option, arrivals)}>
                            <b className="block pr-6 text-[13.5px] font-semibold leading-snug text-fg">{option.name}</b>
                            <span className="mt-1 block text-[12px] text-fg-3">
                              {option.mode_label}
                              {option.hours ? ` · ${t.booking.trip.hours(option.hours)}` : ""}
                            </span>
                            <span className="mt-1 block text-[12px] tabular-nums text-fg-2">{optionPrice(option)}</span>
                          </Toggle>
                        ))}
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ol>
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[12.5px] text-fg-2">
            <Route size={15} className="mt-0.5 flex-none text-t1" />
            <span>
              {lastLeg?.check_out && <b className="block font-semibold text-fg">{t.booking.trip.ends(formatDate(lastLeg.check_out, "long", dateLocale))}</b>}
              {t.booking.trip.note}
            </span>
          </p>
        </Block>
      )}

      {config.addons.length > 0 && (
        <Block icon={<Ticket size={17} />} title={t.booking.addons} index={index++}>
          <div className="grid gap-2.5 sm:grid-cols-2">
            {config.addons.map((addon) => (
              <Toggle key={addon.id} active={addonOn(addon.id) || !addon.optional} onClick={() => addon.optional && toggleAddon(addon.id)} className={addon.optional ? undefined : "cursor-default"}>
                <b className="block pr-6 text-[13.5px] font-semibold leading-snug text-fg">{addon.name}</b>
                <span className="mt-1 flex items-center justify-between gap-2 text-[12px] text-fg-3">
                  {addon.category && <span>{addon.category}</span>}
                  <span className="tabular-nums">{addon.optional ? `${formatMoney(addon.price, addon.currency)} ${t.booking.addonPer(addon.per)}` : t.booking.included}</span>
                </span>
              </Toggle>
            ))}
          </div>
        </Block>
      )}

      {config.pickup && (
        <Block icon={<MapPin size={17} />} title={t.booking.pickup} hint={config.pickup.points.length > 0 ? t.booking.pickupPoints(config.pickup.points.length) : undefined} index={index++}>
          <ul className="flex flex-wrap gap-2">
            {config.pickup.points.map((point) => (
              <li key={point.label} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1.5 text-[12.5px] text-fg-2">
                {point.kind === "aeropuerto" ? <Plane size={13} className="text-t1" /> : <MapPin size={13} className="text-t1" />}
                {point.label}
              </li>
            ))}
          </ul>
          {config.pickup.ask_flight && <p className="mt-3 text-[12px] text-fg-3">{t.booking.pickupFlight}</p>}
        </Block>
      )}
    </section>
  );
}
