"use client";

import * as Popover from "@radix-ui/react-popover";
import { ChevronDown, Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState, type KeyboardEvent } from "react";
import { isUnder, screensOf, type NavGroup, type Screen } from "@/config/navigation";
import { cn } from "@/lib/cn";
import { normalize } from "@/lib/format";
import { readRecent } from "@/lib/recentScreens";
import { useWorkspace } from "./Workspace";

const RECENT_SHOWN = 3;

interface ScreenGroup {
  title: string;
  screens: Screen[];
}

const isHere = (href: string, pathname: string) => isUnder(pathname, href);

function buildGroups(navGroups: NavGroup[], query: string, recent: string[], pathname: string): ScreenGroup[] {
  const all = screensOf(navGroups);
  const term = normalize(query.trim());
  if (term) {
    const found = all.filter((screen) => normalize(screen.label).includes(term));
    return found.length ? [{ title: "Resultados", screens: found }] : [];
  }
  const recentScreens = recent
    .map((href) => all.find((screen) => screen.href === href))
    .filter((screen): screen is Screen => Boolean(screen) && !isHere(screen!.href, pathname))
    .slice(0, RECENT_SHOWN);
  return [...(recentScreens.length ? [{ title: "Usadas recientemente", screens: recentScreens }] : []), ...navGroups.map((group) => ({ title: group.label, screens: group.screens }))];
}

export function ScreenJump() {
  const router = useRouter();
  const pathname = usePathname();
  const { userId, groups: navGroups } = useWorkspace();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);

  const groups = useMemo(() => buildGroups(navGroups, query, recent, pathname), [navGroups, query, recent, pathname]);
  const flat = groups.flatMap((group) => group.screens);

  const changeOpen = (next: boolean) => {
    if (next) {
      setQuery("");
      setActive(0);
      setRecent(readRecent(userId));
    }
    setOpen(next);
  };

  const go = (screen: Screen) => {
    setOpen(false);
    if (pathname !== screen.href) router.push(screen.href);
  };

  const onKey = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, flat.length - 1));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    }
    if (event.key === "Enter" && flat[active]) {
      event.preventDefault();
      go(flat[active]);
    }
  };

  const offsets = groups.map((_, groupIndex) => groups.slice(0, groupIndex).reduce((total, group) => total + group.screens.length, 0));

  return (
    <Popover.Root open={open} onOpenChange={changeOpen}>
      <Popover.Trigger aria-label="Ir a otra pantalla" title="Ir a otra pantalla" className="grid h-8 w-8 place-items-center rounded-lg text-fg-3 transition hover:bg-surface-2 hover:text-fg">
        <ChevronDown size={20} className={cn("transition-transform", open && "rotate-180")} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={8} collisionPadding={12} className="z-50 flex w-72 flex-col overflow-hidden rounded-[14px] border border-line bg-surface shadow-[0_18px_40px_-16px_rgb(14_17_32/0.35)] animate-in">
          <div className="border-b border-line p-2.5">
            <label className="flex items-center gap-2 rounded-[10px] border border-line px-3 py-2 focus-within:border-accent/50">
              <Search size={15} className="flex-none text-accent" />
              <input
                autoFocus
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={onKey}
                placeholder="Buscar pantalla"
                aria-label="Buscar pantalla"
                className="w-full bg-transparent text-sm outline-none placeholder:text-fg-3"
              />
            </label>
          </div>
          <div role="listbox" className="scroll-thin max-h-80 overflow-y-auto py-1">
            {flat.length === 0 && <p className="px-4 py-3 text-sm text-fg-3">No hay ninguna pantalla con ese nombre.</p>}
            {groups.map((group, groupIndex) => (
              <div key={group.title}>
                <span className="block px-4 pb-1 pt-2.5 text-xs font-bold text-fg">{group.title}</span>
                {group.screens.map((screen, screenIndex) => {
                  const index = offsets[groupIndex] + screenIndex;
                  const Icon = screen.icon;
                  const here = isHere(screen.href, pathname) && group.title !== "Usadas recientemente";
                  return (
                    <div
                      key={`${group.title}-${screen.href}`}
                      role="option"
                      aria-selected={here}
                      onMouseEnter={() => setActive(index)}
                      onClick={() => go(screen)}
                      className={cn("mx-1.5 flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-sm", index === active ? "bg-surface-2 text-fg" : "text-fg-2", here && "font-semibold")}
                    >
                      <Icon size={15} className={here ? "text-accent" : "text-fg-3"} />
                      <span className="truncate">{screen.label}</span>
                      {here && <span className="ml-auto text-[11px] font-medium text-fg-3">Aquí estás</span>}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
