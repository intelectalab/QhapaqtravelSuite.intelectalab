"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Box, FileText, Funnel, Luggage, Plus, Send, Target, TriangleAlert, UserRound, Users, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { toneStyle, type Tone } from "@/lib/tone";
import { useMe } from "./SessionProvider";
import { useWorkspace } from "./Workspace";

const OPTIONS: { label: string; href: string; permission: string; icon: LucideIcon; tone: Tone }[] = [
  { label: "Lead", href: "/crm/leads/nuevo", permission: "crm.leads.manage", icon: Funnel, tone: "info" },
  { label: "Oportunidad", href: "/crm/oportunidades/nueva", permission: "crm.opportunities.manage", icon: Target, tone: "violet" },
  { label: "Cliente", href: "/crm/clientes/nuevo", permission: "crm.clients.manage", icon: UserRound, tone: "t1" },
  { label: "Cotización", href: "/cotizaciones/nueva", permission: "quotes.create", icon: FileText, tone: "t3" },
  { label: "Reserva directa", href: "/reservas/nueva", permission: "reservations.create", icon: Luggage, tone: "ok" },
  { label: "Producto turístico", href: "/catalogo/productos/nuevo", permission: "catalog.products.create", icon: Box, tone: "t4" },
  { label: "Incidencia", href: "/operaciones/incidencias", permission: "operations.incidents", icon: TriangleAlert, tone: "bad" },
  { label: "Cobro o pago", href: "/finanzas/cobros", permission: "finance.payments.register", icon: Wallet, tone: "sun" },
  { label: "Campaña", href: "/marketing/campanas", permission: "marketing.campaigns.manage", icon: Send, tone: "violet" },
  { label: "Usuario", href: "/admin/usuarios", permission: "admin.users.manage", icon: Users, tone: "t1" },
];

export function QuickCreate() {
  const me = useMe();
  const { allows } = useWorkspace();
  const options = OPTIONS.filter((option) => me.permissions.includes(option.permission) && allows(option.href));
  if (me.read_only || options.length === 0) return null;

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger data-testid="quick-create" aria-label="Crear" title="Crear" className="inline-flex h-10 flex-none items-center gap-1.5 rounded-xl bg-brand px-3 text-[13px] font-semibold text-brand-fg shadow-[0_6px_16px_-8px_var(--brand)] transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-accent max-sm:w-10 max-sm:justify-center max-sm:px-0">
        <Plus size={17} strokeWidth={2.4} />
        <span className="max-sm:hidden">Crear</span>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 min-w-[220px] rounded-xl border border-line bg-surface p-1.5 shadow-[0_18px_40px_-18px_rgb(14_17_32/0.45)] motion-safe:animate-[drop-in_160ms_ease-out]">
          <DropdownMenu.Label className="px-2.5 pb-1 pt-1.5 text-[11.5px] font-semibold text-fg-3">Crear rápido</DropdownMenu.Label>
          {options.map((option) => (
            <DropdownMenu.Item key={option.href + option.label} asChild>
              <Link href={option.href} style={toneStyle(option.tone)} className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] outline-none data-[highlighted]:bg-surface-2">
                <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-[color-mix(in_srgb,var(--tint)_14%,transparent)] text-[var(--tint)]">
                  <option.icon size={15} />
                </span>
                {option.label}
              </Link>
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
