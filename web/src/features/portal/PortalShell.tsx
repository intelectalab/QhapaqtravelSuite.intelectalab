"use client";

import { Bell, BellRing, Building2, CalendarHeart, FileCheck2, Home, LifeBuoy, MessageCircle, MessageSquareHeart, QrCode, ScrollText, Star, TriangleAlert, UserRound, UsersRound, Wallet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ExternalShell, type ExternalNavItem } from "@/components/shell/ExternalShell";
import { PORTAL_PREVIEW_EXIT } from "@/lib/agency-preview";
import type { PortalSession } from "@/lib/portal";

function navFor(session: PortalSession): ExternalNavItem[] {
  if (session.role === "passenger") {
    const menu = session.menu;
    const on = (key: keyof NonNullable<PortalSession["menu"]>["sections"]) => menu?.sections[key] ?? true;
    return [
      { href: "/portal", label: "Inicio", icon: Home },
      ...(session.trip ? [{ href: `/portal/viajes/${session.trip}`, label: "Mi viaje", icon: CalendarHeart, also: ["/portal/viaje"] }] : []),
      { href: "/portal/mi-pase", label: "Mi pase", icon: QrCode },
      { href: "/portal/avisos", label: "Avisos", icon: BellRing, count: menu?.counts.alerts, alert: (menu?.counts.alerts ?? 0) > 0 },
      { href: "/portal/contactos", label: "Contactos", icon: LifeBuoy },
      ...(on("companions") ? [{ href: "/portal/viajeros", label: "Viajeros", icon: UsersRound, count: menu?.counts.companions, alert: (menu?.counts.companions ?? 0) > 0 }] : []),
      ...(on("messages") ? [{ href: "/portal/mensajes", label: "Mensajes", icon: MessageCircle, count: menu?.counts.messages }] : []),
      ...(on("feedback") ? [{ href: "/portal/comentarios", label: "Comentarios", icon: MessageSquareHeart }] : []),
      ...(on("reviews") ? [{ href: "/portal/califica", label: "Califica tu viaje", icon: Star, count: menu?.counts.reviews }] : []),
      { href: "/portal/datos", label: "Mis datos", icon: UserRound },
    ];
  }
  return [
    { href: "/portal", label: "Inicio", icon: Home },
    { href: "/portal/viajes", label: "Mis viajes", icon: CalendarHeart, count: session.counts.trips },
    { href: "/portal/propuestas", label: "Propuestas", icon: ScrollText, count: session.counts.quotes },
    { href: "/portal/pagos", label: "Pagos", icon: Wallet },
    { href: "/portal/documentos", label: "Documentos", icon: FileCheck2 },
    ...(session.corporate ? [{ href: "/portal/corporativo", label: "Panel corporativo", icon: Building2, count: session.corporate.pending_approvals }] : []),
    { href: "/portal/mensajes", label: "Mensajes", icon: MessageCircle },
    { href: "/portal/notificaciones", label: "Notificaciones", icon: Bell },
    { href: "/portal/datos", label: "Mis datos", icon: UserRound },
  ];
}

export function PortalShell({ session, preview = false, children }: { session: PortalSession | null; preview?: boolean; children: ReactNode }) {
  const pathname = usePathname();
  const alert = session?.role === "passenger" && session.menu?.alert && pathname !== "/portal/avisos" ? session.menu.alert : null;
  const roleLabel = session?.role === "passenger" ? "Portal del pasajero" : "Portal del cliente";

  return (
    <ExternalShell
      home="/portal"
      items={session ? navFor(session) : []}
      account={{ initials: session?.agency.initials ?? "KC", name: session?.agency.name ?? "Tu agencia", detail: roleLabel }}
      person={session ? { name: session.client.name, email: session.user.email, detail: session.role === "passenger" ? "Pasajero" : "Cliente" } : null}
      preview={preview ? { label: `Vista previa de solo lectura${session ? ` como ${session.user.name}` : ""}. No se guarda ningún cambio.`, exitHref: PORTAL_PREVIEW_EXIT } : null}
      footer={`${session?.agency.name ?? "Tu agencia"} · Tus datos están protegidos según la Ley 29733.`}
      banner={
        alert && (
          <Link href="/portal/avisos" className="lift mb-5 flex items-start gap-3 rounded-tile border border-[color-mix(in_srgb,var(--bad)_30%,transparent)] bg-[color-mix(in_srgb,var(--bad)_8%,var(--surface))] px-4 py-3 text-[13.5px]">
            <TriangleAlert size={18} className="mt-0.5 flex-none text-bad" />
            <span className="min-w-0 flex-1">
              <b className="font-semibold text-bad">Alerta de viaje: </b>
              <span className="text-fg">{alert.title}</span>
            </span>
            <span className="flex-none font-semibold text-bad">Ver detalle</span>
          </Link>
        )
      }
    >
      {children}
    </ExternalShell>
  );
}
