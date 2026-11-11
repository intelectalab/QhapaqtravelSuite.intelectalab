"use client";

import { BedDouble, Building2, CalendarDays, ClipboardList, Home, LogOut, Moon, Siren, Sun, Tags, Ticket, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/shell/BrandMark";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import type { SupplierSession } from "@/lib/supplier-portal";
import { applyTheme, parseTheme, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";
import { useStoredValue } from "@/lib/useStoredValue";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  count?: number;
}

const keepTheme = (theme: Theme) => theme;

function navFor(session: SupplierSession): NavItem[] {
  return [
    { href: "/proveedor", label: "Inicio", icon: Home },
    { href: "/proveedor/solicitudes", label: "Solicitudes", icon: ClipboardList, count: session.counts.pending },
    { href: "/proveedor/rooming", label: "Rooming", icon: BedDouble, count: session.counts.rooming },
    { href: "/proveedor/vouchers", label: "Vouchers", icon: Ticket },
    { href: "/proveedor/calendario", label: "Calendario", icon: CalendarDays },
    { href: "/proveedor/pagos", label: "Pagos", icon: Wallet },
    { href: "/proveedor/incidencias", label: "Incidencias", icon: Siren, count: session.counts.incidents },
    { href: "/proveedor/tarifas", label: "Tarifas", icon: Tags },
    { href: "/proveedor/empresa", label: "Mi empresa", icon: Building2 },
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
      className={cn("group relative flex h-10 flex-none items-center gap-2 rounded-xl px-3 text-[13.5px] font-semibold transition", active ? "bg-[color-mix(in_srgb,var(--t3)_14%,var(--surface))] text-t3" : "text-fg-2 hover:bg-surface-2 hover:text-fg")}
    >
      <Icon size={16} className="transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
      {item.label}
      {!!item.count && <span className={cn("grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px]", active ? "bg-t3 text-white" : "bg-[color-mix(in_srgb,var(--warn)_18%,var(--surface))] text-warn")}>{item.count}</span>}
    </Link>
  );
}

export function SupplierShell({ session, children }: { session: SupplierSession | null; children: ReactNode }) {
  const pathname = usePathname();
  const items = session ? navFor(session) : [];
  const isActive = (href: string) => (href === "/proveedor" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));

  return (
    <div className="relative flex min-h-dvh flex-col">
      <div className="weave-band h-2 flex-none" />
      <div className="ambient-glow pointer-events-none absolute inset-x-0 top-2 h-[420px]" />
      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4 sm:px-6">
          <Link href="/proveedor" className="group flex min-w-0 items-center gap-2.5">
            <span className="relative grid h-10 w-10 flex-none place-items-center overflow-hidden rounded-xl bg-t3 text-[14px] font-bold text-white shadow-[0_10px_22px_-12px_var(--t3)]">
              <span aria-hidden className="weave-pattern absolute inset-0 bg-[length:14px_14px] opacity-[0.18] transition-[background-position] duration-700 group-hover:bg-[position:7px_7px]" />
              <span className="relative">{session?.provider.initials ?? "PR"}</span>
            </span>
            <span className="min-w-0 leading-tight">
              <b className="block truncate text-[15px] font-bold tracking-tight">{session?.provider.name ?? "Extranet de proveedores"}</b>
              <span className="block truncate text-[12px] text-fg-3">{session ? `Extranet de ${session.agency.name}` : "Extranet de proveedores"}</span>
            </span>
          </Link>
          <nav aria-label="Secciones" className="ml-6 hidden items-center gap-1 2xl:flex">
            {items.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1.5">
            <ThemeButton />
            {session && (
              <span className="hidden items-center gap-2 rounded-xl px-2 py-1 sm:flex" title={session.user.email}>
                <Avatar name={session.user.name} size="sm" tone="t3" solid />
                <span className="max-w-[160px] truncate text-[13px] font-semibold">{session.user.email}</span>
              </span>
            )}
            <Link href="/salir" className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold text-fg-2 transition hover:bg-[color-mix(in_srgb,var(--bad)_10%,transparent)] hover:text-bad">
              <LogOut size={16} />
              <span className="max-sm:sr-only">Salir</span>
            </Link>
          </div>
        </div>
        {items.length > 0 && (
          <nav aria-label="Secciones" className="scroll-thin mx-auto flex max-w-[1280px] gap-1 overflow-x-auto px-4 pb-2 sm:px-6 2xl:hidden">
            {items.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href)} />
            ))}
          </nav>
        )}
      </header>
      <main className="relative mx-auto w-full max-w-[1280px] flex-1 px-4 pb-14 pt-6 sm:px-6">{children}</main>
      <footer className="border-t border-line bg-surface/60">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3 px-4 py-5 text-[12.5px] text-fg-3 sm:px-6">
          <span>Solo se muestran datos vinculados a su empresa. Los precios de venta de la agencia no forman parte de la extranet.</span>
          <span className="flex items-center gap-1.5">
            <BrandMark size={14} />
            KipuControl
          </span>
        </div>
      </footer>
    </div>
  );
}
