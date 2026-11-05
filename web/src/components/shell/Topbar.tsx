"use client";

import { Bell, Menu, Moon, Sparkles, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { applyTheme, parseTheme, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";
import { useStoredValue } from "@/lib/useStoredValue";
import { useWorkspace } from "./Workspace";

const keepTheme = (theme: Theme) => theme;

function TopIcon({ label, onClick, children, dot }: { label: string; onClick?: () => void; children: ReactNode; dot?: boolean }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="relative grid h-10 w-10 flex-none place-items-center rounded-xl text-fg-2 transition hover:bg-surface-2 hover:text-fg">
      {children}
      {dot && <span className="absolute right-2.5 top-2.5 h-[7px] w-[7px] rounded-full border-2 border-surface bg-brand" />}
    </button>
  );
}

function ThemeToggle() {
  const [theme, storeTheme] = useStoredValue(THEME_STORAGE_KEY, parseTheme, keepTheme);
  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    storeTheme(next);
  };
  return (
    <TopIcon label={theme === "dark" ? "Usar tema claro" : "Usar tema oscuro"} onClick={toggle}>
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </TopIcon>
  );
}

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { searchHint } = useWorkspace();
  return (
    <header className="sticky top-0 z-30 flex h-16 flex-none items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur-md sm:px-6 xl:px-8">
      <button type="button" onClick={onOpenMenu} aria-label="Abrir menú" className="grid h-10 w-10 place-items-center rounded-xl text-fg-2 lg:hidden">
        <Menu size={22} />
      </button>
      <button type="button" className="flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-xl border border-line bg-bg px-3 text-left text-fg-3 transition hover:border-fg-3/40 md:max-w-[520px]">
        <span className="grid h-6 w-6 flex-none place-items-center rounded-md bg-gradient-to-br from-t1 to-t4 text-white">
          <Sparkles size={13} strokeWidth={2.2} />
        </span>
        <span className="truncate text-[13.5px]">
          <span className="sm:hidden">Buscar</span>
          <span className="max-sm:hidden">{searchHint}</span>
        </span>
      </button>
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <TopIcon label="Avisos" dot>
          <Bell size={18} />
        </TopIcon>
      </div>
    </header>
  );
}
