"use client";

import { ArrowRight, LayoutDashboard, LogIn, Menu, Moon, Sun, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/shell/BrandMark";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { SITE_LINKS } from "@/lib/software";
import { applyTheme, parseTheme, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";
import { useStoredValue } from "@/lib/useStoredValue";

const keepTheme = (theme: Theme) => theme;

export function SiteBrand({ inverted = false }: { inverted?: boolean }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label="KipuControl, inicio">
      <span className={cn("grid h-10 w-10 place-items-center rounded-xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105", inverted ? "bg-white" : "bg-menu")}>
        <BrandMark size={22} />
      </span>
      <span className="leading-tight">
        <b className={cn("block text-[16px] font-bold tracking-tight", inverted ? "text-white" : "text-fg")}>KipuControl</b>
      </span>
    </Link>
  );
}

function ThemeSwitch() {
  const [theme, storeTheme] = useStoredValue(THEME_STORAGE_KEY, parseTheme, keepTheme);
  const label = theme === "dark" ? "Usar tema claro" : "Usar tema oscuro";
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

export function SiteHeader({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const access = signedIn ? { href: "/dashboard", label: "Ir a mi panel", icon: <LayoutDashboard size={16} /> } : { href: "/login", label: "Ingresar", icon: <LogIn size={16} /> };

  return (
    <header className={cn("sticky top-0 z-40 transition-[background-color,box-shadow,border-color] duration-300", scrolled || open ? "border-b border-line bg-surface/85 shadow-[0_10px_30px_-24px_rgb(14_17_32/0.5)] backdrop-blur-md" : "border-b border-transparent")}>
      <div className="mx-auto flex h-[68px] max-w-[1200px] items-center gap-4 px-5 sm:px-8">
        <SiteBrand />
        <nav aria-label="Secciones" className="ml-6 hidden items-center gap-1 lg:flex">
          {SITE_LINKS.map((link) => {
            const active = pathname === link.href;
            return (
              <Link key={link.href} href={link.href} className={cn("group relative rounded-lg px-3 py-2 text-[13.5px] font-semibold transition-colors", active ? "text-fg" : "text-fg-2 hover:text-fg")}>
                {link.label}
                <span aria-hidden className={cn("weave-line absolute inset-x-3 -bottom-0.5 h-[3px] origin-left rounded-full transition-transform duration-300", active ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100")} />
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-1.5">
          <ThemeSwitch />
          <Button href={access.href} variant="ghost" icon={access.icon} className="hidden sm:inline-flex">
            {access.label}
          </Button>
          <Button href="/software/contacto" variant="primary" icon={<ArrowRight size={16} />} className="site-sheen relative hidden overflow-hidden sm:inline-flex">
            Solicitar demo
          </Button>
          <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-label={open ? "Cerrar menú" : "Abrir menú"} className="grid h-10 w-10 place-items-center rounded-xl text-fg-2 transition hover:bg-surface-2 lg:hidden">
            {open ? <X size={21} /> : <Menu size={21} />}
          </button>
        </div>
      </div>
      {open && (
        <nav aria-label="Secciones" className="border-t border-line px-5 pb-5 pt-3 animate-[rise-in_320ms_cubic-bezier(0.22,1,0.36,1)_backwards] sm:px-8 lg:hidden">
          <ul className="grid gap-1">
            {SITE_LINKS.map((link, index) => (
              <li key={link.href} className="animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ animationDelay: `${index * 50}ms` }}>
                <Link href={link.href} onClick={() => setOpen(false)} className={cn("flex items-center justify-between rounded-xl px-3 py-3 text-[15px] font-semibold transition hover:bg-surface-2", pathname === link.href ? "text-fg" : "text-fg-2")}>
                  {link.label}
                  <ArrowRight size={16} className="text-fg-3" />
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button href={access.href} variant="secondary" icon={access.icon}>
              {access.label}
            </Button>
            <Button href="/software/contacto" variant="primary">
              Solicitar demo
            </Button>
          </div>
        </nav>
      )}
    </header>
  );
}
