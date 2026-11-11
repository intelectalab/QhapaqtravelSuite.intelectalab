"use client";

import { BedDouble, Check, MapPin, Plane, Sparkles, Ticket } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { BookingConfig, BookingExtras, BookingHotel, LodgingChoice } from "@/lib/site";
import { SectionHeading } from "./Bits";
import { useBooking } from "./ProductBooking";
import { Stepper } from "./SearchBar";
import { useSite } from "./SiteContext";

function hasCustomization(config: BookingConfig | undefined): config is BookingConfig {
  return Boolean(config && (config.options.length > 0 || config.addons.length > 0 || config.lodging || config.pickup));
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
  const { t } = useSite();
  const { config, extras, setExtras, pax, product } = useBooking();
  if (!hasCustomization(config)) return null;
  const seats = pax.adults + pax.children;
  const update = (patch: Partial<BookingExtras>) => setExtras({ ...extras, ...patch });
  const lodging = config.lodging;
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
        <Block icon={<BedDouble size={17} />} title={t.booking.lodging} hint={t.booking.lodgingHint(lodging.legs.length, lodging.nights)} index={index++}>
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
                    <p className="flex flex-wrap items-baseline justify-between gap-2">
                      <b className="text-[14px] font-semibold text-fg">{leg.city}</b>
                      <span className="text-[12px] text-fg-3">{t.booking.nights(leg.nights)}</span>
                    </p>
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
