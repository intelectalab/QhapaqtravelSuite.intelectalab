"use client";

import { Moon, Sun } from "lucide-react";
import { applyTheme, parseTheme, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";
import { useStoredValue } from "@/lib/useStoredValue";

const keepTheme = (theme: Theme) => theme;

export function ThemeToggle() {
  const [theme, storeTheme] = useStoredValue(THEME_STORAGE_KEY, parseTheme, keepTheme);
  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    applyTheme(next);
    storeTheme(next);
  };
  return (
    <button type="button" onClick={toggle} aria-label={theme === "dark" ? "Usar tema claro" : "Usar tema oscuro"} title={theme === "dark" ? "Tema claro" : "Tema oscuro"} className="grid h-10 w-10 place-items-center rounded-full text-[var(--rl-muted)] transition hover:bg-[var(--rl-cobalt-soft)] hover:text-[var(--rl-cobalt)]">
      {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
