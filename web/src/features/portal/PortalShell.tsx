"use client";

import { BellRing, CalendarHeart, Home, LifeBuoy, LogOut, MessageCircle, MessageSquareHeart, Moon, ScrollText, Star, Sun, UserRound, UsersRound, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/shell/BrandMark";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { shortName } from "@/lib/format";
import type { PortalSession } from "@/lib/portal";
import { applyTheme, parseTheme, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";
import { useStoredValue } from "@/lib/useStoredValue";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  count?: number;
}

const keepTheme = (theme: Theme) => theme;

function navFor(session: PortalSession): NavItem[] {
  if (session.role === "passenger") {
    return [
      { href: "/portal", label: "Inicio", icon: Home },
      ...(session.trip ? [{ href: `/portal/viajes/${session.trip}`, label: "Mi viaje", icon: CalendarHeart }] : []),
      { href: "/portal/avisos", label: "Avisos", icon: BellRing },
      { href: "/portal/contactos", label: "Contactos", icon: LifeBuoy },
      { href: "/portal/viajeros", label: "Viajeros", icon: UsersRound },
      { href: "/portal/mensajes", label: "Mensajes", icon: MessageCircle },
      { href: "/portal/comentarios", label: "Comentarios", icon: MessageSquareHeart },
      { href: "/portal/califica", label: "Califica tu viaje", icon: Star },
      { href: "/portal/datos", label: "Mis datos", icon: UserRound },
    ];
  }
  return [
    { href: "/portal", label: "Inicio", icon: Home },
    { href: "/portal/viajes", label: "Mis viajes", icon: CalendarHeart, count: session.counts.trips },
    { href: "/portal/propuestas", label: "Propuestas", icon: ScrollText, count: session.counts.quotes },
    { href: "/portal/pagos", label: "Pagos", icon: Wallet },
    { href: "/portal/mensajes", label: "Mensajes", icon: MessageCircle },
    { href: "/portal/datos", label: "Mis datos", icon: UserRound },
  ];
}

function ThemeButton() {
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
      className="grid h-10 w-10 flex-none place-items-center rounded-xl text-fg-2 transition hover:bg-surface-2 hover:text-fg"
    >
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-10 flex-none items-center gap-2 rounded-xl px-3 text-[13.5px] font-semibold transition",
        active ? "bg-[color-mix(in_srgb,var(--t1)_12%,var(--surface))] text-t1" : "text-fg-2 hover:bg-surface-2 hover:text-fg",
      )}
    >
      <Icon size={16} className="transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
      {item.label}
      {!!item.count && <span className={cn("grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px]", active ? "bg-t1 text-white" : "bg-surface-2 text-fg-2")}>{item.count}</span>}
    </Link>
  );
}

export function PortalShell({ session, children }: { session: PortalSession | null; children: ReactNode }) {
  const pathname = usePathname();
  const items = session ? navFor(session) : [];
  const isActive = (href: string) => (href === "/portal" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="weave-band h-2 flex-none" />
      <div className="ambient-glow pointer-events-none absolute inset-x-0 top-2 h-[420px]" />
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-4 sm:px-6">
          <Link href="/portal" className="group flex min-w-0 items-center gap-2.5">
            <span className="relative grid h-10 w-10 flex-none place-items-center overflow-hidden rounded-xl bg-t1 text-[14px] font-bold text-white shadow-[0_10px_22px_-12px_var(--t1)]">
              <span aria-hidden className="weave-pattern absolute inset-0 bg-[length:14px_14px] opacity-[0.18] transition-[background-position] duration-700 group-hover:bg-[position:7px_7px]" />
              <span className="relative">{session?.agency.initials ?? "KC"}</span>
            </span>
            <span className="min-w-0 leading-tight">
              <b className="block truncate text-[15px] font-bold tracking-tight">{session?.agency.name ?? "Tu agencia"}</b>
              <span className="block truncate text-[12px] text-fg-3">{session?.role === "passenger" ? "Portal del pasajero" : "Portal del cliente"}</span>
            </span>
          </Link>
          <nav aria-label="Secciones" className="ml-6 hidden items-center gap-1 lg:flex">
            {items.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeButton />
            {session && (
              <span className="hidden items-center gap-2 rounded-xl px-2 py-1 sm:flex" title={session.user.email}>
                <Avatar name={session.client.name} size="sm" solid />
                <span className="max-w-[160px] truncate text-[13px] font-semibold">{shortName(session.client.name)}</span>
              </span>
            )}
            <Link href="/salir" className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-fg-2 transition hover:bg-[color-mix(in_srgb,var(--bad)_10%,transparent)] hover:text-bad">
              <LogOut size={16} />
              <span className="max-sm:sr-only">Salir</span>
            </Link>
          </div>
        </div>
        {items.length > 0 && (
          <nav aria-label="Secciones" className="scroll-thin mx-auto flex max-w-[1240px] gap-1 overflow-x-auto px-4 pb-2 sm:px-6 lg:hidden">
            {items.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </nav>
        )}
      </header>
      <main className="relative mx-auto w-full max-w-[1240px] flex-1 px-4 pb-14 pt-6 sm:px-6">{children}</main>
      <footer className="border-t border-line bg-surface/60">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-4 py-5 text-[12.5px] text-fg-3 sm:px-6">
          <span>{session?.agency.name ?? "Tu agencia"} · Tus datos están protegidos según la Ley 29733.</span>
          <span className="flex items-center gap-1.5">
            <BrandMark size={14} />
            KipuControl
          </span>
        </div>
      </footer>
    </div>
  );
}
