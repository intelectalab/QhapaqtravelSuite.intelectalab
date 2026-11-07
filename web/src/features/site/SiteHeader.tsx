"use client";

import { Menu, MessageSquareText, Moon, ShoppingBag, Sun, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { setSiteLocale } from "@/app/(sitio)/sitio/[agencia]/actions";
import { cn } from "@/lib/cn";
import { LOCALE_NAME, SITE_LOCALES } from "@/lib/site-i18n";
import { applyTheme, parseTheme, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";
import { useStoredValue } from "@/lib/useStoredValue";
import { useSite } from "./SiteContext";

const keepTheme = (theme: Theme) => theme;

const LINKS = [
  { path: "/destinos", key: "destinations" },
  { path: "/tours?tipo=tours", key: "tours" },
  { path: "/tours?tipo=paquetes", key: "packages" },
  { path: "/tours?tipo=experiencias", key: "experiences" },
  { path: "/viajes-a-medida", key: "tailored" },
  { path: "/contacto", key: "contact" },
] as const;

function LocaleSwitch() {
  const { locale, t } = useSite();
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div role="group" aria-label={t.header.language} className={cn("flex h-10 items-center rounded-xl border border-line p-0.5 transition-opacity", pending && "opacity-60")}>
      {SITE_LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          lang={option}
          aria-pressed={locale === option}
          title={LOCALE_NAME[option]}
          data-testid={`site-locale:${option}`}
          onClick={() => {
            if (option === locale) return;
            start(async () => {
              await setSiteLocale(option);
              router.refresh();
            });
          }}
          className={cn("h-full rounded-[9px] px-2.5 text-[12px] font-bold uppercase tracking-wide transition", locale === option ? "bg-brand text-brand-fg" : "text-fg-3 hover:text-fg")}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

export function AgencyMark({ name, initials, logo, inverted = false }: { name: string; initials: string; logo: string | null; inverted?: boolean }) {
  const { href, t } = useSite();
  return (
    <Link href={href()} className="group flex min-w-0 items-center gap-2.5" aria-label={t.header.home(name)}>
      <span className="relative grid h-10 w-10 flex-none place-items-center overflow-hidden rounded-xl bg-brand text-[13px] font-bold tracking-wide text-brand-fg shadow-[0_8px_18px_-10px_var(--brand)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">
        {logo ? <span aria-hidden className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${logo})` }} /> : initials}
        <span aria-hidden className="weave-band absolute inset-x-0 bottom-0 h-[3px] opacity-80" />
      </span>
      <span className="min-w-0 leading-tight">
        <b className={cn("block truncate text-[16px] font-bold tracking-tight", inverted ? "text-white" : "text-fg")}>{name}</b>
        <span className={cn("text-[10.5px] font-medium tracking-[0.14em]", inverted ? "text-white/60" : "text-fg-3")}>{t.header.tagline}</span>
      </span>
    </Link>
  );
}

function ThemeSwitch() {
  const { t } = useSite();
  const [theme, storeTheme] = useStoredValue(THEME_STORAGE_KEY, parseTheme, keepTheme);
  const label = theme === "dark" ? t.header.lightTheme : t.header.darkTheme;
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={() => {
        const next: Theme = theme === "dark" ? "light" : "dark";
        applyTheme(next);
        storeTheme(next);
      }}
      className="grid h-10 w-10 flex-none place-items-center rounded-xl text-fg-2 transition hover:rotate-12 hover:bg-surface-2 hover:text-fg"
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

export function SiteHeader({ name, initials, logo }: { name: string; initials: string; logo: string | null }) {
  const { href, t } = useSite();
  const pathname = usePathname();
  const search = useSearchParams();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (path: string) => {
    const [route, query] = path.split("?");
    if (pathname !== href(route) && !pathname.startsWith(`${href(route)}/`)) return false;
    if (!query) return true;
    const [key, value] = query.split("=");
    return search.get(key) === value;
  };

  return (
    <header className={cn("sticky top-0 z-40 transition-[background-color,box-shadow,border-color] duration-300", scrolled || open ? "border-b border-line bg-surface/90 shadow-[0_10px_30px_-24px_rgb(14_17_32/0.5)] backdrop-blur-md" : "border-b border-transparent bg-bg/60 backdrop-blur-sm")}>
      <div className="mx-auto flex h-[68px] max-w-[1240px] items-center gap-3 px-4 sm:px-8">
        <AgencyMark name={name} initials={initials} logo={logo} />
        <nav aria-label={t.header.sections} className="ml-4 hidden items-center gap-0.5 xl:flex">
          {LINKS.map((link) => {
            const active = isActive(link.path);
            return (
              <Link key={link.path} href={href(link.path)} className={cn("group relative rounded-lg px-3 py-2 text-[13.5px] font-semibold transition-colors", active ? "text-fg" : "text-fg-2 hover:text-fg")}>
                {t.header.links[link.key]}
                <span aria-hidden className={cn("weave-line absolute inset-x-3 -bottom-0.5 h-[3px] origin-left rounded-full transition-transform duration-300", active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100")} />
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <LocaleSwitch />
          <ThemeSwitch />
          <Link href={href("/carrito")} aria-label={t.header.cart} title={t.header.cartTitle} className="grid h-10 w-10 flex-none place-items-center rounded-xl text-fg-2 transition hover:-translate-y-0.5 hover:bg-surface-2 hover:text-fg">
            <ShoppingBag size={18} />
          </Link>
          <Link href={href("/viajes-a-medida")} className="hidden h-10 items-center gap-2 rounded-control bg-brand px-4 text-[13.5px] font-semibold text-brand-fg shadow-[0_6px_16px_-8px_var(--brand)] transition hover:-translate-y-0.5 hover:brightness-110 sm:inline-flex">
            <MessageSquareText size={16} />
            {t.header.quote}
          </Link>
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? t.header.closeMenu : t.header.openMenu} className="grid h-10 w-10 place-items-center rounded-xl text-fg-2 transition hover:bg-surface-2 hover:text-fg xl:hidden">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>
      {open && (
        <nav aria-label={t.header.mobileMenu} className="border-t border-line bg-surface px-4 pb-5 pt-3 xl:hidden">
          <ul className="grid gap-1">
            {LINKS.map((link, index) => (
              <li key={link.path} className="animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ animationDelay: `${index * 40}ms` }}>
                <Link href={href(link.path)} onClick={() => setOpen(false)} className={cn("flex h-11 items-center rounded-xl px-3 text-[15px] font-semibold transition", isActive(link.path) ? "bg-surface-2 text-fg" : "text-fg-2 hover:bg-surface-2 hover:text-fg")}>
                  {t.header.links[link.key]}
                </Link>
              </li>
            ))}
          </ul>
          <Link href={href("/viajes-a-medida")} onClick={() => setOpen(false)} className="mt-3 flex h-11 items-center justify-center gap-2 rounded-control bg-brand text-[14px] font-semibold text-brand-fg">
            <MessageSquareText size={16} />
            {t.header.quote}
          </Link>
        </nav>
      )}
    </header>
  );
}
