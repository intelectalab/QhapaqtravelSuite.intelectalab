"use client";

import { BedDouble, Building2, CalendarDays, ClipboardList, Home, Siren, Tags, Ticket, Wallet } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { ExternalShell, type ExternalNavItem } from "@/components/shell/ExternalShell";
import type { SupplierSession } from "@/lib/supplier-portal";
import { SupplierFrame } from "./SupplierFrame";

function navFor(session: SupplierSession): ExternalNavItem[] {
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

export function SupplierShell({ session, children }: { session: SupplierSession | null; children: ReactNode }) {
  const pathname = usePathname();

  return (
    <ExternalShell
      home="/proveedor"
      items={session ? navFor(session) : []}
      account={{ initials: session?.provider.initials ?? "PR", name: session?.provider.name ?? "Extranet de proveedores", detail: session ? `Extranet de ${session.agency.name}` : "Extranet de proveedores" }}
      person={session ? { name: session.user.name, email: session.user.email, detail: "Proveedor" } : null}
      footer="Solo se muestran datos vinculados a tu empresa. Los precios de venta de la agencia no forman parte de la extranet."
      banner={session && pathname !== "/proveedor" && <SupplierFrame frame={session.frame} pathname={pathname} />}
    >
      {children}
    </ExternalShell>
  );
}
