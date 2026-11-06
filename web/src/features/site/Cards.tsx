import { ArrowUpRight, CalendarDays, Clock, Flame, Languages, MapPin, Mountain, Quote, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import { siteHref, type Departure, type DestinationCard as Destination, type ProductCard as Product, type Review } from "@/lib/site";
import { Chip, Occupancy, PriceTag, RatingLine, Stars } from "./Bits";
import { Scenery } from "./Scenery";

const RISE = "animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]";

export function ProductCard({ product, base, index = 0, className }: { product: Product; base: string; index?: number; className?: string }) {
  const tagTone = { offer: "brand", guaranteed: "ok", last: "warn", featured: "t2" } as const;
  return (
    <Link
      href={siteHref(base, `/tours/${product.slug}${product.on_date ? `?fecha=${product.on_date.date}` : ""}`)}
      className={cn("lift group flex flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card", RISE, className)}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <Scenery seed={product.slug} className="aspect-[16/10]">
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {product.tags.slice(0, 2).map((tag) => (
            <Chip key={tag.key} tone={tagTone[tag.key as keyof typeof tagTone] ?? "mute"} className="bg-surface/95 shadow-sm backdrop-blur">
              {tag.key === "offer" && <Flame size={12} />}
              {tag.key === "guaranteed" && <ShieldCheck size={12} />}
              {tag.label}
            </Chip>
          ))}
        </div>
        <span className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 text-[11.5px] font-semibold text-white backdrop-blur">
          <MapPin size={12} />
          {product.destination.name}
        </span>
        <span className="absolute bottom-3 right-3 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-fg opacity-0 transition duration-300 group-hover:opacity-100">
          <ArrowUpRight size={16} />
        </span>
      </Scenery>
      <div className="flex flex-1 flex-col p-4">
        <span className="text-[11.5px] font-semibold tracking-wide text-fg-3">{product.category}</span>
        <h3 className="mt-0.5 text-[16px] font-bold leading-snug tracking-tight text-fg transition-colors group-hover:text-brand">{product.name}</h3>
        <div className="mt-1.5">
          <RatingLine rating={product.rating} compact />
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1.5 text-[12px] text-fg-2">
          <li className="inline-flex items-center gap-1">
            <Clock size={13} className="text-fg-3" />
            {product.duration}
          </li>
          <li className="inline-flex items-center gap-1">
            <Users size={13} className="text-fg-3" />
            {product.modality}
          </li>
          {product.languages.length > 0 && (
            <li className="inline-flex items-center gap-1">
              <Languages size={13} className="text-fg-3" />
              {product.languages.join(" · ")}
            </li>
          )}
        </ul>
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <PriceTag from={product.from} list={product.list} label={product.on_date ? `El ${formatDate(product.on_date.date)}` : "Desde"} unit={product.kind === "traslados" ? "por vehículo" : "por persona"} />
          <span className="text-right text-[11.5px] leading-tight text-fg-3">
            {product.next_departure ? (
              <>
                Próxima salida
                <b className="block text-[12px] font-semibold text-fg-2">{formatDate(product.next_departure.date)}</b>
              </>
            ) : product.daily ? (
              <>
                Todos los días
                <b className="block text-[12px] font-semibold text-fg-2">Confirmación en 24 h</b>
              </>
            ) : null}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function DestinationTile({ destination, base, index = 0, large = false }: { destination: Destination; base: string; index?: number; large?: boolean }) {
  return (
    <Link href={siteHref(base, `/destinos/${destination.slug}`)} className={cn("lift group relative block overflow-hidden rounded-card", RISE, large ? "min-h-[300px] sm:row-span-2 sm:min-h-[420px]" : "min-h-[200px]")} style={{ animationDelay: `${index * 70}ms` }}>
      <div className="absolute inset-0">
        <Scenery seed={destination.slug} className="h-full w-full" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
      <div className="relative flex h-full min-h-[inherit] flex-col justify-end p-5 text-white">
        {destination.altitude && (
          <span className="mb-auto inline-flex w-fit items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11.5px] font-semibold backdrop-blur">
            <Mountain size={12} />
            {destination.altitude}
          </span>
        )}
        <h3 className={cn("font-bold tracking-tight", large ? "text-[30px]" : "text-[21px]")}>{destination.name}</h3>
        {destination.tagline && <p className="mt-0.5 text-[13px] text-white/80">{destination.tagline}</p>}
        <div className="mt-3 flex items-center justify-between gap-2 text-[12.5px]">
          <span className="font-semibold">{destination.count === 1 ? "1 experiencia" : `${destination.count} experiencias`}</span>
          {destination.from && <span className="text-white/80">Desde {formatMoney(destination.from.amount, destination.from.currency)}</span>}
        </div>
      </div>
    </Link>
  );
}

export function DepartureCard({ departure, base, index = 0 }: { departure: Departure; base: string; index?: number }) {
  const date = new Date(`${departure.date}T12:00:00`);
  const day = new Intl.DateTimeFormat("es-PE", { day: "2-digit", timeZone: "America/Lima" }).format(date);
  const month = new Intl.DateTimeFormat("es-PE", { month: "short", timeZone: "America/Lima" }).format(date).replace(".", "");
  const weekday = new Intl.DateTimeFormat("es-PE", { weekday: "long", timeZone: "America/Lima" }).format(date);
  return (
    <Link
      href={siteHref(base, `/tours/${departure.product?.slug ?? ""}?fecha=${departure.date}`)}
      className={cn("lift group flex gap-4 rounded-card border border-line bg-surface p-4 shadow-card", RISE)}
      style={{ animationDelay: `${index * 60}ms` }}
    >
      <span className="grid h-[64px] w-[58px] flex-none place-items-center content-center rounded-2xl bg-[color-mix(in_srgb,var(--t1)_10%,var(--surface))] text-center">
        <b className="text-[22px] font-bold leading-none text-t1">{day}</b>
        <span className="text-[11px] font-semibold text-fg-3">{month}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <b className="line-clamp-2 text-[14.5px] font-semibold leading-snug text-fg transition-colors group-hover:text-brand">{departure.product?.name}</b>
          {departure.guaranteed && (
            <Chip tone="ok" className="flex-none">
              <ShieldCheck size={12} />
              Garantizada
            </Chip>
          )}
        </span>
        <span className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] capitalize text-fg-3">
          <span className="inline-flex items-center gap-1">
            <CalendarDays size={12} />
            {weekday} · {departure.time}
          </span>
          {departure.price && <span className="normal-case">Desde {formatMoney(departure.price.amount, departure.price.currency)}</span>}
        </span>
        <span className="mt-2.5 block">
          <Occupancy sold={departure.sold} capacity={departure.capacity} spots={departure.spots} />
        </span>
      </span>
    </Link>
  );
}

export function ReviewCard({ review, base, index = 0 }: { review: Review; base: string; index?: number }) {
  return (
    <article className={cn("lift flex h-full flex-col rounded-card border border-line bg-surface p-5 shadow-card", RISE)} style={{ animationDelay: `${index * 60}ms` }}>
      <div className="flex items-center justify-between gap-3">
        <Stars value={review.stars} />
        <Chip tone={review.verified ? "ok" : "mute"}>{review.source}</Chip>
      </div>
      <Quote size={22} className="mt-3 text-[color-mix(in_srgb,var(--t2)_80%,transparent)]" />
      {review.title && <h3 className="mt-1 text-[15px] font-semibold leading-snug text-fg">{review.title}</h3>}
      {review.body && <p className="mt-1.5 line-clamp-5 text-[13.5px] leading-relaxed text-fg-2">{review.body}</p>}
      {review.reply && (
        <p className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-[12.5px] leading-relaxed text-fg-2">
          <b className="font-semibold text-fg">Respuesta de la agencia: </b>
          {review.reply}
        </p>
      )}
      <footer className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-4 text-[12px] text-fg-3">
        <span>
          <b className="block text-[13px] font-semibold text-fg">{review.author}</b>
          {[review.country, formatDate(review.date)].filter(Boolean).join(" · ")}
        </span>
        {review.product && (
          <Link href={siteHref(base, `/tours/${review.product.slug}`)} className="max-w-[60%] truncate font-semibold text-accent hover:underline">
            {review.product.name}
          </Link>
        )}
      </footer>
    </article>
  );
}
