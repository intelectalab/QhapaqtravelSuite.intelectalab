"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, ChevronsUpDown, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { groupFor, isUnder, type NavGroup, type Screen } from "@/config/navigation";
import { cn } from "@/lib/cn";
import { initials, shortName } from "@/lib/format";
import type { NavCounts } from "@/lib/dashboard";
import { useStoredValue } from "@/lib/useStoredValue";
import { BrandMark } from "./BrandMark";
import { useWorkspace } from "./Workspace";

const parseOpen = (raw: string | null): string[] => {
  try {
    const value = JSON.parse(raw ?? "null");
    return Array.isArray(value) ? value : ["general"];
  } catch {
    return ["general"];
  }
};
const serializeOpen = (value: string[]) => JSON.stringify(value);

const groupCount = (group: NavGroup, counts: NavCounts) => group.screens.reduce((total, screen) => total + (screen.countKey ? counts[screen.countKey] ?? 0 : 0), 0);

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onExpand?: () => void;
  onNavigate?: () => void;
}

export function Sidebar({ collapsed, onToggle, onExpand, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { groups, account, navigation } = useWorkspace();
  const activeGroup = groupFor(pathname, groups);
  const [openGroups, setOpenGroups] = useStoredValue(`qhapaq-menu-groups:${navigation}`, parseOpen, serializeOpen);

  const toggleGroup = (id: string) => setOpenGroups(openGroups.includes(id) ? openGroups.filter((item) => item !== id) : [...openGroups, id]);
  const openFromRail = (id: string) => {
    if (!openGroups.includes(id)) setOpenGroups([...openGroups, id]);
    onExpand?.();
  };

  return (
    <aside className={cn("relative flex h-full flex-col overflow-hidden bg-menu text-white/70 transition-[width] duration-200", collapsed ? "w-[76px]" : "w-[264px]")}>
      <div className="weave-band h-2 flex-none" />

      <div className={cn("flex flex-none items-center gap-2.5", collapsed ? "flex-col px-0 pb-3.5 pt-4" : "px-4 pb-4 pl-[18px] pt-[18px]")}>
        <span className="grid h-[34px] w-[34px] flex-none place-items-center rounded-[10px] bg-white">
          <BrandMark />
        </span>
        {!collapsed && (
          <span className="min-w-0 leading-tight">
            <b className="block text-base font-bold tracking-tight text-white">Qhapaq</b>
            <span className="text-[10.5px] uppercase tracking-[0.16em] text-white/55">Travel Suite</span>
          </span>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Mostrar menú" : "Plegar menú"}
          title={collapsed ? "Mostrar menú" : "Plegar menú"}
          className={cn(
            "grid h-[30px] w-[30px] flex-none place-items-center rounded-lg border transition",
            collapsed ? "border-transparent bg-t2 text-t2-fg hover:brightness-105" : "ml-auto border-white/10 bg-white/[0.07] text-white/75 hover:text-white",
          )}
        >
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
      </div>

      <div className={cn("mb-3 flex flex-none items-center gap-2.5 rounded-xl text-left", collapsed ? "mx-auto p-1.5" : "mx-3.5 border border-white/[0.07] bg-white/[0.06] p-2.5")} title={collapsed ? account.name : undefined}>
        <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-t2 text-[11px] font-bold text-t2-fg">{account.initials}</span>
        {!collapsed && (
          <span className="min-w-0 flex-1">
            <b className="block truncate text-[13px] font-semibold text-white">{account.name}</b>
            {account.detail && <span className="block truncate text-[11.5px] text-white/50">{account.detail}</span>}
          </span>
        )}
      </div>

      <nav className={cn("scroll-thin flex flex-1 flex-col overflow-y-auto pb-3", collapsed ? "items-center gap-1 px-0" : "px-2.5")} aria-label="Menú principal">
        {groups.map((group) =>
          collapsed ? (
            <RailItem key={group.id} group={group} active={activeGroup?.id === group.id} onClick={() => openFromRail(group.id)} />
          ) : (
            <GroupBlock
              key={group.id}
              group={group}
              open={openGroups.includes(group.id) || activeGroup?.id === group.id}
              onToggle={() => toggleGroup(group.id)}
              pathname={pathname}
              onNavigate={onNavigate}
            />
          ),
        )}
      </nav>

      <UserMenu collapsed={collapsed} />
    </aside>
  );
}

function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { person, logoutHref } = useWorkspace();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className={cn("relative flex flex-none items-center gap-2.5 border-t border-white/[0.08] py-3.5 text-left outline-none transition hover:bg-white/[0.04]", collapsed ? "justify-center" : "px-[18px]")}>
        <span className="weave-pattern pointer-events-none absolute inset-0 opacity-[0.05]" />
        <span className="relative grid h-8 w-8 flex-none place-items-center rounded-full text-xs font-semibold text-white" style={{ background: person.color ?? "var(--t4)" }}>
          {initials(person.name)}
        </span>
        {!collapsed && (
          <>
            <span className="relative min-w-0 flex-1">
              <b className="block truncate text-[13px] text-white">{shortName(person.name)}</b>
              <span className="text-xs text-white/50">{person.detail}</span>
            </span>
            <ChevronsUpDown size={15} className="relative text-white/45" />
          </>
        )}
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content side="top" align="start" sideOffset={8} className="z-50 w-60 rounded-[14px] border border-line bg-surface p-1.5 text-fg shadow-[0_18px_40px_-16px_rgb(14_17_32/0.35)] animate-in">
          <div className="px-2.5 pb-2 pt-1.5">
            <b className="block truncate text-[13.5px] font-semibold">{person.name}</b>
            <span className="block truncate text-xs text-fg-3">{person.email}</span>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          <DropdownMenu.Item asChild>
            <Link href={logoutHref} prefetch={false} className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13.5px] font-medium outline-none data-[highlighted]:bg-surface-2">
              <LogOut size={16} className="text-fg-3" />
              Cerrar sesión
            </Link>
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function RailItem({ group, active, onClick }: { group: NavGroup; active: boolean; onClick: () => void }) {
  const Icon = group.icon;
  const count = groupCount(group, useWorkspace().counts);
  return (
    <button
      type="button"
      onClick={onClick}
      title={group.label}
      aria-label={group.label}
      className={cn("relative grid h-11 w-[46px] flex-none place-items-center rounded-[10px] transition", active ? "bg-white/10 text-white" : "text-white/55 hover:bg-white/[0.05] hover:text-white")}
    >
      {active && <span className="absolute -left-[15px] bottom-2 top-2 w-[3px] rounded-r bg-t2" />}
      <Icon size={19} strokeWidth={1.8} className={active ? "text-t2" : undefined} />
      {count > 0 && <span className="absolute right-2 top-2 h-[7px] w-[7px] rounded-full border-2 border-menu bg-brand" />}
    </button>
  );
}

function GroupBlock({ group, open, onToggle, pathname, onNavigate }: { group: NavGroup; open: boolean; onToggle: () => void; pathname: string; onNavigate?: () => void }) {
  const count = groupCount(group, useWorkspace().counts);
  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[12.5px] font-semibold text-white/50 transition hover:text-white/80"
      >
        <span className="flex-1 truncate">{group.label}</span>
        {!open && count > 0 && <span className="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand px-1.5 text-[10.5px] font-semibold text-brand-fg">{count}</span>}
        <ChevronDown size={14} className={cn("flex-none transition-transform", !open && "-rotate-90")} />
      </button>
      {open && (
        <div className="mb-2 flex flex-col gap-0.5 animate-in">
          {group.screens.map((screen) => (
            <ScreenLink key={screen.href} screen={screen} active={isUnder(pathname, screen.href)} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

function ScreenLink({ screen, active, onNavigate }: { screen: Screen; active: boolean; onNavigate?: () => void }) {
  const Icon = screen.icon;
  const { counts } = useWorkspace();
  const count = screen.countKey ? counts[screen.countKey] ?? 0 : 0;
  return (
    <Link
      href={screen.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn("relative flex items-center gap-3 rounded-[10px] px-3 py-[8px] text-[13.5px] font-medium transition", active ? "bg-white/10 text-white" : "hover:bg-white/[0.05] hover:text-white")}
    >
      {active && <span className="absolute -left-2.5 bottom-2 top-2 w-[3px] rounded-r bg-t2" />}
      <Icon size={17} strokeWidth={1.8} className={cn("flex-none", active ? "text-t2" : "text-white/50")} />
      <span className="truncate">{screen.label}</span>
      {count > 0 && <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-brand-fg">{count}</span>}
    </Link>
  );
}
