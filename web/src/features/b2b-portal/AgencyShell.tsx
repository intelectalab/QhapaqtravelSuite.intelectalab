"use client";

import { Building2, CalendarRange, Eye, Home, LogOut, Moon, Package, Plus, ReceiptText, Sun, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/shell/BrandMark";
import { Avatar } from "@/components/ui/Avatar";
import { AGENCY_PREVIEW_EXIT } from "@/lib/agency-preview";
import { AGENCY_HOME, type AgencySession } from "@/lib/b2b-portal";
import { cn } from "@/lib/cn";
import { applyTheme, parseTheme, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";
import { useStoredValue } from "@/lib/useStoredValue";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  count?: number;
  alert?: boolean;
}

const keepTheme = (theme: Theme) => theme;

function navFor(session: AgencySession): NavItem[] {
  return [
    { href: AGENCY_HOME, label: "Inicio", icon: Home },
    { href: `${AGENCY_HOME}/catalogo`, label: "Catálogo", icon: Package, count: session.counts.catalog },
    { href: `${AGENCY_HOME}/reservas`, label: "Mis reservas", icon: CalendarRange, count: session.counts.reservations },
    { href: `${AGENCY_HOME}/cuenta`, label: "Estado de cuenta", icon: ReceiptText, count: session.counts.due, alert: session.counts.due > 0 },
    { href: `${AGENCY_HOME}/mi-agencia`, label: "Mi agencia", icon: Building2 },
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
        active ? "bg-[color-mix(in_srgb,var(--t3)_13%,var(--surface))] text-t3" : "text-fg-2 hover:bg-surface-2 hover:text-fg",
      )}
    >
      <Icon size={16} className="transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
      {item.label}
      {!!item.count && (
        <span className={cn("grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px]", item.alert ? "bg-warn text-white" : active ? "bg-t3 text-white" : "bg-surface-2 text-fg-2")}>{item.count}</span>
      )}
    </Link>
  );
}

export function AgencyShell({ session, preview = false, children }: { session: AgencySession | null; preview?: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const items = session ? navFor(session) : [];
  const isActive = (href: string) => (href === AGENCY_HOME ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <div className="relative flex min-h-dvh flex-col">
      {preview && (
        <div className="z-40 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-fg px-4 py-2 text-center text-[12.5px] text-bg">
          <span className="flex items-center gap-1.5"><Eye size={14} /> Vista previa de solo lectura{session ? ` como ${session.user.name}` : ""}. No se guarda ningún cambio.</span>
          <a href={AGENCY_PREVIEW_EXIT} className="rounded-md bg-bg/15 px-2.5 py-0.5 font-semibold transition hover:bg-bg/25">Volver al backoffice</a>
        </div>
      )}
      <div className="weave-band h-2 flex-none" />
      <div className="ambient-glow pointer-events-none absolute inset-x-0 top-2 h-[420px]" />
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4 sm:px-6">
          <Link href={AGENCY_HOME} className="group flex min-w-0 items-center gap-2.5">
            <span className="relative grid h-10 w-10 flex-none place-items-center overflow-hidden rounded-xl bg-t3 text-[14px] font-bold text-white shadow-[0_10px_22px_-12px_var(--t3)]">
              <span aria-hidden className="weave-pattern absolute inset-0 bg-[length:14px_14px] opacity-[0.18] transition-[background-position] duration-700 group-hover:bg-[position:7px_7px]" />
              <span className="relative">{session?.agency.initials ?? "AG"}</span>
            </span>
            <span className="min-w-0 leading-tight">
              <b className="block max-w-[220px] truncate text-[15px] font-bold tracking-tight">{session?.agency.name ?? "Agencia aliada"}</b>
              <span className="block truncate text-[12px] text-fg-3">Agencias aliadas · {session?.tenant.name ?? "KipuControl"}</span>
            </span>
          </Link>
          <nav aria-label="Secciones" className="ml-4 hidden items-center gap-1 xl:flex">
            {items.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            {session && (
              <Link href={`${AGENCY_HOME}/catalogo`} className="hidden h-10 items-center gap-1.5 rounded-control bg-brand px-3.5 text-[13px] font-semibold text-brand-fg shadow-[0_6px_16px_-8px_var(--brand)] transition hover:-translate-y-0.5 hover:brightness-110 sm:flex">
                <Plus size={15} /> Nueva reserva
              </Link>
            )}
            <ThemeButton />
            {session && (
              <span className="hidden items-center gap-2 rounded-xl px-2 py-1 md:flex" title={session.user.email}>
                <Avatar name={session.user.name} size="sm" solid />
              </span>
            )}
            <Link href="/salir" className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-fg-2 transition hover:bg-[color-mix(in_srgb,var(--bad)_10%,transparent)] hover:text-bad">
              <LogOut size={16} />
              <span className="max-sm:sr-only">Salir</span>
            </Link>
          </div>
        </div>
        {items.length > 0 && (
          <nav aria-label="Secciones" className="scroll-thin mx-auto flex max-w-[1280px] gap-1 overflow-x-auto px-4 pb-2 sm:px-6 xl:hidden">
            {items.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </nav>
        )}
      </header>
      <main className="relative mx-auto w-full max-w-[1280px] flex-1 px-4 pb-14 pt-6 sm:px-6">{children}</main>
      <footer className="border-t border-line bg-surface/60">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-5 text-[12.5px] text-fg-3 sm:px-6">
          <span>
            {session?.tenant.name ?? "Tu operador"} · Tarifas netas confidenciales para agencias con convenio.
          </span>
          <span className="flex items-center gap-1.5">
            <BrandMark size={14} />
            KipuControl
          </span>
        </div>
      </footer>
    </div>
  );
}
