"use client";

import { Menu } from "lucide-react";
import { useMemo } from "react";
import { GlobalSearch } from "@/features/account/GlobalSearch";
import { NotificationBell } from "@/features/account/NotificationBell";
import { HelpButton } from "@/features/help/HelpButton";
import { readPlatformNotifications, searchPlatform } from "@/app/plataforma/(consola)/configuracion/actions";
import { AGENCY_HELP, PLATFORM_HELP } from "@/lib/help";
import { QuickCreate } from "./QuickCreate";
import { ThemeToggle } from "./ThemeToggle";
import { useWorkspace } from "./Workspace";

const FIELD_PREFIX = "/mobile/";

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { searchHint, navigation, groups } = useWorkspace();
  const agency = navigation === "agency";
  const screens = useMemo(() => groups.flatMap((group) => group.screens.map((screen) => ({ href: screen.href, label: screen.label, group: group.label }))), [groups]);
  const fieldOnly = agency && screens.every((screen) => screen.href.startsWith(FIELD_PREFIX));
  return (
    <header className="sticky top-0 z-30 flex h-16 flex-none items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur-md sm:px-6 xl:px-8">
      <button type="button" onClick={onOpenMenu} aria-label="Abrir menú" className="grid h-10 w-10 place-items-center rounded-xl text-fg-2 lg:hidden">
        <Menu size={22} />
      </button>
      {fieldOnly ? null : agency ? (
        <GlobalSearch hint={searchHint} screens={screens} />
      ) : (
        <GlobalSearch hint={searchHint} search={searchPlatform} screens={screens} title="Buscar en la plataforma" description="Busca agencias, facturas de la plataforma, planes, cupones y pantallas de la consola por código o nombre." placeholder="Agencia, RUC, factura, plan, cupón o pantalla" />
      )}
      <div className="ml-auto flex items-center gap-1">
        {agency && <QuickCreate />}
        <ThemeToggle />
        <HelpButton realm={agency ? AGENCY_HELP : PLATFORM_HELP} />
        {agency ? <NotificationBell /> : <NotificationBell feedUrl="/plataforma/configuracion/notificaciones" readAll={readPlatformNotifications} logHref="/plataforma/auditoria" emptyHint="Aquí aparecerán los cobros fallidos, pruebas por vencer, alertas de uso y solicitudes nuevas." />}
      </div>
    </header>
  );
}
