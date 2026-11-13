import { Footprints, Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cityName, rlPath, type RlOverview } from "@/lib/rutas-libres";
import { ThemeToggle } from "./ThemeToggle";

export function Brand({ base, name }: { base: string; name: string }) {
  return (
    <Link href={rlPath(base)} className="group flex items-center gap-2.5" aria-label={`${name}, inicio`}>
      <span className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--rl-cobalt)] text-white shadow-[var(--rl-shadow-float)] transition-transform duration-300 group-hover:-rotate-6">
        <Footprints size={20} />
      </span>
      <span className="leading-tight">
        <b className="block text-[16px] font-extrabold tracking-tight">Rutas Libres</b>
        <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--rl-muted)]">Free tours del Perú</span>
      </span>
    </Link>
  );
}

export function Header({ base, overview }: { base: string; overview: RlOverview }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--rl-line)] bg-[var(--rl-glass)] backdrop-blur-xl">
      <div className="rl-wrap flex h-[72px] items-center justify-between gap-4">
        <Brand base={base} name={overview.brand.name} />
        <nav aria-label="Principal" className="hidden items-center gap-1 lg:flex">
          {overview.cities.slice(0, 4).map((city) => (
            <Link key={city.id} href={rlPath(base, `/${city.id}`)} className="rl-ghost">{cityName(city.id)}</Link>
          ))}
          <Link href={rlPath(base, "/blog")} className="rl-ghost">Blog</Link>
          <Link href={rlPath(base, "/agencias")} className="rl-ghost">Para agencias</Link>
        </nav>
        <div className="flex items-center gap-1.5">
          <ThemeToggle />
          <Link href={rlPath(base, "/agencias#registro")} className="rl-btn hidden sm:inline-flex"><Plus size={16} />Publica tu tour</Link>
        </div>
      </div>
      <nav aria-label="Ciudades" className="rl-wrap flex gap-2 overflow-x-auto pb-3 lg:hidden">
        {overview.cities.map((city) => (
          <Link key={city.id} href={rlPath(base, `/${city.id}`)} className="rl-chip">{cityName(city.id)}</Link>
        ))}
        <Link href={rlPath(base, "/blog")} className="rl-chip">Blog</Link>
        <Link href={rlPath(base, "/agencias")} className="rl-chip">Para agencias</Link>
      </nav>
    </header>
  );
}

export function Footer({ base, overview }: { base: string; overview: RlOverview }) {
  return (
    <footer className="rl-band mt-24">
      <div className="rl-wrap grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="flex flex-col gap-4">
          <span className="text-white"><Brand base={base} name={overview.brand.name} /></span>
          <p className="max-w-[36ch] text-[13.5px] text-slate-400">Free walking tours y experiencias con guías locales. Agencias verificadas con RUC y licencia, y reseñas solo de quienes asistieron.</p>
        </div>
        <FooterList title="Destinos" links={overview.cities.map((city) => ({ href: rlPath(base, `/${city.id}`), label: `Free tours en ${cityName(city.id)}` }))} />
        <FooterList title="Descubre" links={[{ href: rlPath(base, "/blog"), label: "Blog de viajes" }, { href: rlPath(base), label: "Tours destacados" }]} />
        <FooterList title="Agencias" links={[{ href: rlPath(base, "/agencias"), label: "Publica gratis" }, { href: rlPath(base, "/agencias#planes"), label: "Planes y beneficios" }, { href: rlPath(base, "/agencias#registro"), label: "Registra tu agencia" }]} />
      </div>
      <div className="border-t border-white/10">
        <p className="rl-wrap py-5 text-[12.5px] text-slate-500">{overview.brand.name} · {overview.brand.domain} · Con la tecnología de KipuControl</p>
      </div>
    </footer>
  );
}

function FooterList({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div>
      <h2 className="mb-3 text-[13px] font-semibold text-white">{title}</h2>
      <ul className="flex flex-col gap-2 text-[13.5px] text-slate-400">
        {links.map((link) => (
          <li key={link.href + link.label}><Link href={link.href} className="transition hover:text-white">{link.label}</Link></li>
        ))}
      </ul>
    </div>
  );
}

export function Section({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rl-wrap pt-16 sm:pt-20 ${className}`}>{children}</section>;
}

export function SectionHead({ kicker, title, description, action }: { kicker?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-[62ch]">
        {kicker && <span className="rl-kicker">{kicker}</span>}
        <h2 className="rl-h2 mt-1">{title}</h2>
        {description && <p className="rl-muted mt-2 text-[16px]">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Crumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Ruta" className="flex flex-wrap items-center gap-1.5 text-[13px]">
      {items.map((item, index) => (
        <span key={item.label} className="flex items-center gap-1.5">
          {index > 0 && <span className="opacity-50">/</span>}
          {item.href ? <Link href={item.href} className="opacity-80 transition hover:opacity-100 hover:underline">{item.label}</Link> : <span className="font-semibold">{item.label}</span>}
        </span>
      ))}
    </nav>
  );
}
