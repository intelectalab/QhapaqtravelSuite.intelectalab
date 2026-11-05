"use client";

/**
 * Shell del back-office (COMPONENTES.md «Sidebar + topbar»; prototipo v2.4 «Responsive y experiencia móvil»).
 *
 * Escritorio: sidebar 256 px (colapsable a 68 px) + topbar 58 px con búsqueda global, «Nuevo», ver sitio, tema,
 * notificaciones y menú de usuario.
 * ≤ 980 px: el sidebar sale de la pantalla y se abre con el botón de menú (overlay).
 * ≤ 640 px (mismo comportamiento que app.css `.topbar` móvil):
 *   - la búsqueda es un ICONO que se expande sobre la barra al enfocarla (`.gsearch:focus-within`);
 *   - las acciones secundarias (ver sitio público, cambiar tema) pasan al MENÚ DE USUARIO (`.top-opt` oculto);
 *   - quedan visibles: menú, «Nuevo» (solo icono), notificaciones y usuario; objetivos táctiles de 40 px.
 * El menú lateral llega ya filtrado por permisos desde `/me/access` (nav); la API vuelve a validar cada pantalla.
 * data-testid: app-shell, nav-item:{clave}, user-menu, user-menu-logout (SELECTORES.md §2).
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { PHONE, useMediaQuery } from "@/lib/ui/useMediaQuery";

export type NavItem = { key: string; label: string; href: string; group?: string };

type Props = {
  nav: NavItem[];
  user: { name: string; initials: string; roleLabel: string };
  tenantName: string;
  onSearch: (q: string) => void; // GET /api/v1/search?q= (≥ 2 caracteres, máx. 12, filtrado por permisos y ownership)
  onNew?: () => void; // creación rápida (solo si el rol puede crear algo)
  onToggleTheme: () => void; // preferencia guardada en el perfil (no solo en el navegador)
  onLogout: () => void;
  notifications: ReactNode; // campana con contador (Reverb)
  children: ReactNode;
};

export function AppShell({ nav, user, tenantName, onSearch, onNew, onToggleTheme, onLogout, notifications, children }: Props) {
  const phone = useMediaQuery(PHONE);
  const pathname = usePathname();
  const [sideOpen, setSideOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [query, setQuery] = useState("");
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => setSideOpen(false), [pathname]); // cerrar el menú móvil al navegar
  useEffect(() => {
    if (!userOpen) return;
    const close = (e: MouseEvent) => !userRef.current?.contains(e.target as Node) && setUserOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [userOpen]);

  // Acciones secundarias: en la topbar en escritorio; dentro del menú de usuario en ≤ 640 px.
  const secondary = [
    { key: "site", label: "Ver sitio web público", href: "/es" },
    { key: "theme", label: "Cambiar tema", onClick: onToggleTheme },
  ];

  return (
    <div data-testid="app-shell" className="min-h-dvh bg-bg text-fg">
      {/* Sidebar */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-40 flex flex-col bg-side text-side-fg transition-transform",
          collapsed ? "w-sidebar-collapsed" : "w-sidebar",
          sideOpen ? "translate-x-0" : "-translate-x-full min-[981px]:translate-x-0",
        ].join(" ")}
        aria-label="Menú principal"
      >
        <div className="flex h-topbar items-center gap-2 px-4 font-bold">{collapsed ? "Q" : tenantName}</div>
        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {nav.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.key}
                href={item.href}
                data-testid={`nav-item:${item.key}`}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-10 items-center rounded-control px-2.5 text-sm ${active ? "bg-side-act font-semibold" : "text-side-fg-2 hover:text-side-fg"}`}
              >
                {collapsed ? item.label.slice(0, 2) : item.label}
              </Link>
            );
          })}
        </nav>
        <button type="button" className="hidden h-10 text-xs text-side-fg-2 min-[981px]:block" onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? "Expandir" : "Contraer menú"}
        </button>
      </aside>
      {sideOpen && <div className="fixed inset-0 z-30 bg-black/40 min-[981px]:hidden" onClick={() => setSideOpen(false)} aria-hidden="true" />}

      <div className={collapsed ? "min-[981px]:pl-[68px]" : "min-[981px]:pl-[256px]"}>
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex min-h-[56px] items-center gap-2 border-b border-line bg-surface px-3 tablet:min-h-topbar tablet:gap-3 tablet:px-[22px]">
          <button type="button" aria-label="Abrir menú" className="h-10 w-10 rounded-control min-[981px]:hidden" onClick={() => setSideOpen(true)}>
            ☰
          </button>

          {/* Búsqueda global: campo completo en escritorio; icono que se expande en ≤ 640 px */}
          <form
            role="search"
            className="group relative flex-1 max-[640px]:flex-none max-[640px]:focus-within:absolute max-[640px]:focus-within:inset-x-2.5 max-[640px]:focus-within:top-2 max-[640px]:focus-within:z-[45]"
            onSubmit={(e) => {
              e.preventDefault();
              if (query.trim().length >= 2) onSearch(query.trim());
            }}
          >
            <input
              type="search"
              aria-label="Búsqueda global"
              placeholder="Buscar cliente, cotización, reserva, producto…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className={[
                "h-control w-full max-w-xl rounded-control border border-line bg-surface-2 pl-9 pr-3",
                // móvil: botón cuadrado de 40 px con el icono; al enfocar se expande y muestra el texto
                "max-[640px]:h-10 max-[640px]:w-10 max-[640px]:cursor-pointer max-[640px]:p-0 max-[640px]:text-transparent max-[640px]:placeholder:text-transparent",
                "max-[640px]:focus:w-full max-[640px]:focus:pl-9 max-[640px]:focus:text-fg max-[640px]:focus:placeholder:text-fg-3 max-[640px]:focus:shadow-pop",
              ].join(" ")}
            />
            <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-3">
              ⌕
            </span>
          </form>

          <div className="ml-auto flex items-center gap-1.5 tablet:gap-2">
            {onNew && (
              <button type="button" onClick={onNew} className="h-10 rounded-control bg-accent px-3 font-semibold text-accent-fg max-[640px]:w-10 max-[640px]:px-0" aria-label="Nuevo">
                <span aria-hidden="true">＋</span>
                <span className="max-[640px]:hidden"> Nuevo</span>
              </button>
            )}
            {!phone &&
              secondary.map((s) =>
                s.href ? (
                  <Link key={s.key} href={s.href} title={s.label} aria-label={s.label} className="grid h-10 w-10 place-items-center rounded-control">
                    ◎
                  </Link>
                ) : (
                  <button key={s.key} type="button" title={s.label} aria-label={s.label} onClick={s.onClick} className="h-10 w-10 rounded-control">
                    ◐
                  </button>
                ),
              )}
            {notifications}

            <div ref={userRef} className="relative">
              <button
                type="button"
                data-testid="user-menu"
                aria-haspopup="menu"
                aria-expanded={userOpen}
                onClick={() => setUserOpen((o) => !o)}
                className="flex h-10 items-center gap-2 rounded-pill p-[3px]"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-xs font-bold text-accent-fg">{user.initials}</span>
                <span className="text-left text-xs leading-tight max-[640px]:hidden">
                  <b className="block">{user.name}</b>
                  <span className="text-fg-3">{user.roleLabel}</span>
                </span>
              </button>
              {userOpen && (
                <div role="menu" className="absolute right-0 top-12 z-50 w-64 rounded-sm border border-line bg-surface p-1.5 shadow-pop">
                  <Link role="menuitem" href="/perfil" className="block rounded-control px-3 py-2.5 text-sm hover:bg-surface-2">
                    Mi perfil
                  </Link>
                  {/* En móvil, las acciones secundarias de la topbar viven aquí */}
                  {phone &&
                    secondary.map((s) =>
                      s.href ? (
                        <Link key={s.key} role="menuitem" href={s.href} className="block rounded-control px-3 py-2.5 text-sm hover:bg-surface-2">
                          {s.label}
                        </Link>
                      ) : (
                        <button key={s.key} role="menuitem" type="button" onClick={s.onClick} className="block w-full rounded-control px-3 py-2.5 text-left text-sm hover:bg-surface-2">
                          {s.label}
                        </button>
                      ),
                    )}
                  <button
                    role="menuitem"
                    type="button"
                    data-testid="user-menu-logout"
                    onClick={onLogout}
                    className="block w-full rounded-control px-3 py-2.5 text-left text-sm text-bad hover:bg-surface-2"
                  >
                    Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="px-3 pb-7 pt-3.5 tablet:px-[22px] tablet:pt-5">{children}</main>
      </div>
    </div>
  );
}
