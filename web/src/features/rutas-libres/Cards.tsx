import { ArrowRight, BadgeCheck, Clock, Languages, MapPin, Star } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { formatDate, formatMoney } from "@/lib/format";
import { cityGradient, cityName, readMinutes, RL_LANGUAGES, rlPath, type RlCity, type RlPost } from "@/lib/rutas-libres";
import type { ShowcaseListing } from "@/lib/vitrina";

export function Cover({ city, className = "", children }: { city: string | null; className?: string; children?: ReactNode }) {
  return (
    <div className={`rl-cover ${className}`}>
      <div aria-hidden className="rl-zoom absolute inset-0" style={{ background: cityGradient(city) }} />
      {children}
    </div>
  );
}

export function Price({ listing, size = "md" }: { listing: Pick<ShowcaseListing, "model" | "price" | "currency">; size?: "md" | "lg" }) {
  const big = size === "lg" ? "text-[28px]" : "text-[18px]";
  if (listing.model === "pago") {
    return (
      <span className="flex items-baseline gap-1.5"><span className="rl-muted text-[12.5px]">desde</span><span className={`rl-price ${big}`}>{formatMoney(listing.price, listing.currency)}</span><span className="rl-muted text-[12.5px]">por persona</span></span>
    );
  }
  return <span className="flex items-baseline gap-1.5"><span className={`rl-price ${big}`}>Gratis</span><span className="rl-muted text-[12.5px]">propina al final</span></span>;
}

export function Rating({ value, count }: { value: number | null; count: number }) {
  if (!count || value === null) return <span className="rl-muted text-[12.5px]">Nuevo</span>;
  return (
    <span className="inline-flex items-center gap-1 text-[13px]">
      <Star size={14} className="fill-amber-400 text-amber-400" />
      <b>{value.toFixed(1)}</b>
      <span className="rl-muted">({count.toLocaleString("es-PE")})</span>
    </span>
  );
}

export function TourCard({ listing, base, index = 0 }: { listing: ShowcaseListing; base: string; index?: number }) {
  return (
    <Link href={rlPath(base, `/tour/${listing.slug}`)} style={{ animationDelay: `${index * 60}ms` }} className="rl-card rl-hover rl-rise group flex flex-col overflow-hidden">
      <Cover city={listing.city} className="aspect-[4/3]">
        <div className="flex h-full flex-col justify-between p-4">
          <div className="flex flex-wrap gap-1.5">
            {listing.agency.verified && <span className="rl-tag rl-tag-glass"><BadgeCheck size={13} className="text-emerald-600" />Verificada</span>}
            {listing.featured && <span className="rl-tag rl-tag-coral">Destacado</span>}
          </div>
          <span className="flex items-center gap-1.5 text-[13px] font-semibold"><MapPin size={14} />{listing.zone ? `${listing.zone}, ` : ""}{cityName(listing.city)}</span>
        </div>
      </Cover>
      <div className="flex flex-1 flex-col gap-2.5 p-5">
        <div className="flex items-center justify-between gap-2">
          <Rating value={listing.rating} count={listing.reviews} />
          {listing.theme && <span className="rl-tag rl-tag-cobalt">{listing.theme}</span>}
        </div>
        <h3 className="rl-h3 transition-colors group-hover:text-[var(--rl-cobalt)]">{listing.title}</h3>
        <p className="rl-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
          <span className="inline-flex items-center gap-1"><Clock size={13} />{listing.duration_hours} h</span>
          <span className="inline-flex items-center gap-1"><Languages size={13} />{listing.languages.map((code) => RL_LANGUAGES[code] ?? code).join(", ")}</span>
        </p>
        <p className="rl-muted text-[12.5px]">Organiza {listing.agency.name}</p>
        <div className="mt-auto flex items-end justify-between gap-3 border-t border-[var(--rl-line)] pt-3.5">
          <Price listing={listing} />
          <span className="grid h-9 w-9 flex-none place-items-center rounded-full bg-[var(--rl-coral-soft)] text-[var(--rl-coral)] transition-transform duration-300 group-hover:translate-x-1"><ArrowRight size={16} /></span>
        </div>
      </div>
    </Link>
  );
}

export function CityTile({ city, base, large = false, index = 0 }: { city: RlCity; base: string; large?: boolean; index?: number }) {
  return (
    <Link href={rlPath(base, `/${city.id}`)} style={{ animationDelay: `${index * 80}ms` }} className={`rl-card rl-hover rl-rise group overflow-hidden border-0 ${large ? "min-h-[280px] md:row-span-2 md:min-h-[420px]" : "min-h-[200px]"}`}>
      <Cover city={city.id} className="h-full min-h-[inherit] rounded-[1.5rem]">
        <div className="flex h-full min-h-[inherit] flex-col justify-end gap-1 p-6">
          <span className="text-[12px] font-semibold uppercase tracking-[0.08em] opacity-85">{city.zones} zonas · {city.rating ? `★ ${city.rating.toFixed(1)}` : "Nuevo destino"}</span>
          <b className={`${large ? "text-[40px]" : "text-[28px]"} font-extrabold leading-none tracking-tight`}>{cityName(city.id)}</b>
          <span className="mt-2 inline-flex items-center gap-1.5 text-[14px] font-semibold">{city.tours} {city.tours === 1 ? "tour" : "tours"} <ArrowRight size={15} className="transition-transform duration-300 group-hover:translate-x-1" /></span>
        </div>
      </Cover>
    </Link>
  );
}

export function PostCard({ post, base, index = 0 }: { post: RlPost; base: string; index?: number }) {
  return (
    <Link href={rlPath(base, `/blog/${post.slug}`)} style={{ animationDelay: `${index * 70}ms` }} className="rl-card rl-hover rl-rise group flex flex-col overflow-hidden">
      <Cover city={post.city} className="aspect-[16/9]">
        <div className="flex h-full items-start p-4">{post.city && <span className="rl-tag rl-tag-glass">{cityName(post.city)}</span>}</div>
      </Cover>
      <div className="flex flex-1 flex-col gap-2 p-5">
        <span className="rl-muted text-[12.5px]">{post.published_at ? formatDate(post.published_at) : ""} · {readMinutes(post.word_count)} min de lectura</span>
        <h3 className="rl-h3 transition-colors group-hover:text-[var(--rl-cobalt)]">{post.title}</h3>
        <p className="rl-muted text-[14px]">{post.excerpt}</p>
        <span className="rl-ghost mt-auto -ml-3 self-start">Leer la guía <ArrowRight size={15} /></span>
      </div>
    </Link>
  );
}

export function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="rl-muted rounded-[1.5rem] border border-dashed border-[var(--rl-line-strong)] px-6 py-12 text-center text-[15px]">{children}</p>;
}
