"use client";

import { Eye, Menu, PanelLeftClose, PanelLeftOpen, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { BrandMark } from "./BrandMark";
import { ShellFrame, type SidebarSlot } from "./ShellFrame";
import { ShellUserMenu } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";

export interface ExternalNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  count?: number;
  alert?: boolean;
  also?: string[];
}

export interface ExternalShellProps {
  home: string;
  items: ExternalNavItem[];
  account: { initials: string; name: string; detail: string };
  person: { name: string; email: string; detail: string } | null;
  preview?: { label: string; exitHref: string } | null;
  actions?: ReactNode;
  banner?: ReactNode;
  footer: string;
  children: ReactNode;
}

function useActive(home: string) {
  const pathname = usePathname();
  const matches = (href: string) => (href === home ? pathname === href : pathname === href || pathname.startsWith(`${href}/`));
  return (item: ExternalNavItem) => matches(item.href) || (item.also ?? []).some(matches);
}

function ExternalSidebar({ slot, home, items, account, person }: { slot: SidebarSlot } & Pick<ExternalShellProps, "home" | "items" | "account" | "person">) {
  const { collapsed, onToggle, onNavigate, tagged = true } = slot;
  const isActive = useActive(home);

  return (
    <aside className={cn("relative flex h-full flex-col overflow-hidden bg-menu text-white/70 transition-[width] duration-200", collapsed ? "w-[76px]" : "w-[264px]")}>
      <div className="weave-band h-2 flex-none" />

      <div className={cn("flex flex-none items-center gap-2.5", collapsed ? "flex-col px-0 pb-3.5 pt-4" : "px-4 pb-4 pl-[18px] pt-[18px]")}>
        <Link href={home} onClick={onNavigate} title={collapsed ? account.name : undefined} className="group relative grid h-[34px] w-[34px] flex-none place-items-center overflow-hidden rounded-[10px] bg-t2 text-[12px] font-bold text-t2-fg">
          <span aria-hidden className="weave-pattern absolute inset-0 bg-[length:14px_14px] opacity-[0.18] transition-[background-position] duration-700 group-hover:bg-[position:7px_7px]" />
          <span className="relative">{account.initials}</span>
        </Link>
        {!collapsed && (
          <span className="min-w-0 flex-1 leading-tight">
            <b className="block truncate text-[14px] font-bold tracking-tight text-white">{account.name}</b>
            <span className="block truncate text-[11.5px] text-white/50">{account.detail}</span>
          </span>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Mostrar menú" : "Plegar menú"}
          title={collapsed ? "Mostrar menú" : "Plegar menú"}
          className={cn("grid h-[30px] w-[30px] flex-none place-items-center rounded-lg border transition", collapsed ? "border-transparent bg-t2 text-t2-fg hover:brightness-105" : "border-white/10 bg-white/[0.07] text-white/75 hover:text-white")}
        >
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
      </div>

      <nav aria-label="Secciones" className={cn("scroll-thin flex flex-1 flex-col gap-0.5 overflow-y-auto pb-3", collapsed ? "items-center px-0" : "px-2.5")}>
        {items.map((item) => (
          <ExternalLink key={item.href} item={item} active={isActive(item)} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>

      {person && <ShellUserMenu collapsed={collapsed} tagged={tagged} person={{ ...person, color: null }} logoutHref="/salir" account={null} />}
    </aside>
  );
}

function ExternalLink({ item, active, collapsed, onNavigate }: { item: ExternalNavItem; active: boolean; collapsed: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  const count = item.count ?? 0;
  const badge = item.alert ? "bg-warn text-white" : "bg-brand text-brand-fg";

  if (collapsed) {
    return (
      <Link href={item.href} onClick={onNavigate} title={item.label} aria-label={item.label} aria-current={active ? "page" : undefined} className={cn("relative grid h-11 w-[46px] flex-none place-items-center rounded-[10px] transition", active ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/[0.05] hover:text-white")}>
        {active && <span className="absolute -left-[15px] bottom-2 top-2 w-[3px] rounded-r bg-t2" />}
        <Icon size={19} strokeWidth={1.8} className={active ? "text-t2" : undefined} />
        {count > 0 && <span className={cn("absolute right-2 top-2 h-[7px] w-[7px] rounded-full border-2 border-menu", item.alert ? "bg-warn" : "bg-brand")} />}
      </Link>
    );
  }

  return (
    <Link href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn("group relative flex items-center gap-3 rounded-[10px] px-3 py-[9px] text-[13.5px] font-medium transition", active ? "bg-white/10 text-white" : "hover:bg-white/[0.05] hover:text-white")}>
      {active && <span className="absolute -left-2.5 bottom-2 top-2 w-[3px] rounded-r bg-t2" />}
      <Icon size={17} strokeWidth={1.8} className={cn("flex-none transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110", active ? "text-t2" : "text-white/50")} />
      <span className="truncate">{item.label}</span>
      {count > 0 && <span className={cn("ml-auto grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold", badge)}>{count}</span>}
    </Link>
  );
}

export function ExternalShell({ home, items, account, person, preview, actions, banner, footer, children }: ExternalShellProps) {
  const isActive = useActive(home);
  const current = items.find(isActive);

  return (
    <ShellFrame
      sidebar={(slot) => <ExternalSidebar slot={slot} home={home} items={items} account={account} person={person} />}
      topbar={(openMenu) => (
        <>
          {preview && (
            <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-fg px-4 py-2 text-center text-[12.5px] text-bg">
              <span className="flex items-center gap-1.5">
                <Eye size={14} /> {preview.label}
              </span>
              <a href={preview.exitHref} className="rounded-md bg-bg/15 px-2.5 py-0.5 font-semibold transition hover:bg-bg/25">
                Volver al backoffice
              </a>
            </div>
          )}
          <header className="flex h-16 flex-none items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur-md sm:px-6 xl:px-8">
            <button type="button" onClick={openMenu} aria-label="Abrir menú" className="grid h-10 w-10 place-items-center rounded-xl text-fg-2 lg:hidden">
              <Menu size={22} />
            </button>
            <span className="min-w-0 truncate text-[14px] font-semibold text-fg-2">{current?.label ?? account.name}</span>
            <div className="ml-auto flex items-center gap-1.5">
              {actions}
              <ThemeToggle />
            </div>
          </header>
        </>
      )}
    >
      <main className="relative w-full flex-1 px-4 pb-14 pt-6 sm:px-6 xl:px-8">
        <div className="mx-auto w-full max-w-[1240px]">
          {banner}
          {children}
        </div>
      </main>
      <footer className="border-t border-line bg-surface/60">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-4 py-5 text-[12.5px] text-fg-3 sm:px-6">
          <span>{footer}</span>
          <span className="flex items-center gap-1.5">
            <BrandMark size={14} />
            KipuControl
          </span>
        </div>
      </footer>
    </ShellFrame>
  );
}
