"use client";

import { Menu, Moon, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { GlobalSearch } from "@/features/account/GlobalSearch";
import { NotificationBell } from "@/features/account/NotificationBell";
import { loadPlatformNotifications, readPlatformNotifications, searchPlatform } from "@/app/plataforma/(consola)/configuracion/actions";
import { PLATFORM_NAV_GROUPS } from "@/config/platformNavigation";
import { applyTheme, parseTheme, THEME_STORAGE_KEY, type Theme } from "@/lib/theme";
import { useStoredValue } from "@/lib/useStoredValue";
import { useWorkspace } from "./Workspace";

const keepTheme = (theme: Theme) => theme;

const PLATFORM_SCREENS = PLATFORM_NAV_GROUPS.flatMap((group) => group.screens.map((screen) => ({ href: screen.href, label: screen.label, group: group.label })));

function TopIcon({ label, onClick, children }: { label: string; onClick?: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="relative grid h-10 w-10 flex-none place-items-center rounded-xl text-fg-2 transition hover:bg-surface-2 hover:text-fg">
      {children}
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
  const { searchHint, navigation } = useWorkspace();
  const agency = navigation === "agency";
  return (
    <header className="sticky top-0 z-30 flex h-16 flex-none items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur-md sm:px-6 xl:px-8">
      <button type="button" onClick={onOpenMenu} aria-label="Abrir menú" className="grid h-10 w-10 place-items-center rounded-xl text-fg-2 lg:hidden">
        <Menu size={22} />
      </button>
      {agency ? (
        <GlobalSearch hint={searchHint} />
      ) : (
        <GlobalSearch hint={searchHint} search={searchPlatform} screens={PLATFORM_SCREENS} title="Buscar en la plataforma" description="Busca agencias, facturas de la plataforma, planes, cupones y pantallas de la consola por código o nombre." placeholder="Agencia, RUC, factura, plan, cupón o pantalla" />
      )}
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        {agency ? <NotificationBell /> : <NotificationBell load={loadPlatformNotifications} readAll={readPlatformNotifications} logHref="/plataforma/auditoria" emptyHint="Aquí aparecerán los cobros fallidos, pruebas por vencer, alertas de uso y solicitudes nuevas." />}
      </div>
    </header>
  );
}
