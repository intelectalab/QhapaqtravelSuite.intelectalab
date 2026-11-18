"use client";

import { Building2, CalendarRange, Home, Package, Plus, ReceiptText } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ExternalShell, type ExternalNavItem } from "@/components/shell/ExternalShell";
import { AGENCY_PREVIEW_EXIT } from "@/lib/agency-preview";
import { AGENCY_HOME, type AgencySession } from "@/lib/b2b-portal";

function navFor(session: AgencySession): ExternalNavItem[] {
  return [
    { href: AGENCY_HOME, label: "Inicio", icon: Home },
    { href: `${AGENCY_HOME}/catalogo`, label: "Catálogo", icon: Package, count: session.counts.catalog },
    { href: `${AGENCY_HOME}/reservas`, label: "Mis reservas", icon: CalendarRange, count: session.counts.reservations },
    { href: `${AGENCY_HOME}/cuenta`, label: "Estado de cuenta", icon: ReceiptText, count: session.counts.due, alert: session.counts.due > 0 },
    { href: `${AGENCY_HOME}/mi-agencia`, label: "Mi agencia", icon: Building2 },
  ];
}

export function AgencyShell({ session, preview = false, children }: { session: AgencySession | null; preview?: boolean; children: ReactNode }) {
  return (
    <ExternalShell
      home={AGENCY_HOME}
      items={session ? navFor(session) : []}
      account={{ initials: session?.agency.initials ?? "AG", name: session?.agency.name ?? "Agencia aliada", detail: `Agencias aliadas · ${session?.tenant.name ?? "KipuControl"}` }}
      person={session ? { name: session.user.name, email: session.user.email, detail: "Agencia aliada" } : null}
      preview={preview ? { label: `Vista previa de solo lectura${session ? ` como ${session.user.name}` : ""}. No se guarda ningún cambio.`, exitHref: AGENCY_PREVIEW_EXIT } : null}
      footer={`${session?.tenant.name ?? "Tu operador"} · Tarifas netas confidenciales para agencias con convenio.`}
      actions={
        session && (
          <Link href={`${AGENCY_HOME}/catalogo`} className="hidden h-10 items-center gap-1.5 rounded-control bg-brand px-3.5 text-[13px] font-semibold text-brand-fg shadow-[0_6px_16px_-8px_var(--brand)] transition hover:-translate-y-0.5 hover:brightness-110 sm:flex">
            <Plus size={15} /> Nueva reserva
          </Link>
        )
      }
    >
      {children}
    </ExternalShell>
  );
}
