"use client";

import { CalendarCheck2, ClipboardList, Siren, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { InfoTip } from "@/components/ui/InfoTip";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { SupplierFrame as Frame } from "@/lib/supplier-portal";
import { toneStyle, type Tone } from "@/lib/tone";

function FrameTile({ href, icon: Icon, tone, label, value, note, info, active }: { href: string; icon: LucideIcon; tone: Tone; label: string; value: ReactNode; note: string; info: string; active: boolean }) {
  return (
    <div style={toneStyle(tone)} className={cn("lift relative flex items-center gap-3 rounded-tile border bg-surface px-3.5 py-2.5", active ? "border-[color-mix(in_srgb,var(--tint)_45%,transparent)]" : "border-line")}>
      <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[color-mix(in_srgb,var(--tint)_12%,var(--surface))] text-[var(--tint)]">
        <Icon size={17} />
      </span>
      <Link href={href} className="min-w-0 flex-1 after:absolute after:inset-0">
        <span className="block truncate text-[11.5px] font-semibold text-fg-3">{label}</span>
        <b className="block truncate text-[17px] font-bold leading-tight text-[var(--tint)]">{value}</b>
        <span className="block truncate text-[11.5px] text-fg-3">{note}</span>
      </Link>
      <span className="relative z-10">
        <InfoTip>{info}</InfoTip>
      </span>
    </div>
  );
}

export function SupplierFrame({ frame, pathname }: { frame: Frame; pathname: string }) {
  const balances = Object.entries(frame.receivable).filter(([, amount]) => Math.abs(amount) > 0.004);
  const on = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  return (
    <section aria-label="Resumen de su cuenta" className="mb-6 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
      <FrameTile
        href="/proveedor/solicitudes"
        icon={ClipboardList}
        tone={frame.pending ? "warn" : "ok"}
        label="Solicitudes por responder"
        value={frame.pending}
        note={frame.alternatives ? `${frame.alternatives} con alternativa en revisión` : `Responda en máximo ${frame.response_hours} h`}
        info="Servicios que la agencia le solicitó y esperan su confirmación o rechazo. Las alternativas que propuso y la agencia aún revisa se cuentan aparte."
        active={on("/proveedor/solicitudes")}
      />
      <FrameTile
        href="/proveedor/calendario"
        icon={CalendarCheck2}
        tone="t1"
        label="Llegadas próximos 7 días"
        value={frame.upcoming}
        note={`${frame.upcoming_pax} ${frame.upcoming_pax === 1 ? "pasajero" : "pasajeros"}`}
        info="Servicios confirmados o en curso con fecha entre hoy y los próximos 7 días."
        active={on("/proveedor/calendario")}
      />
      <FrameTile
        href="/proveedor/pagos"
        icon={Wallet}
        tone="t3"
        label="Saldo por cobrar a la agencia"
        value={balances.length === 0 ? "Sin saldo" : balances.map(([currency, amount]) => formatMoney(amount, currency)).join(" + ")}
        note="Por moneda, sin conversión"
        info="Saldo pendiente de las cuentas por pagar que la agencia registró a su nombre."
        active={on("/proveedor/pagos")}
      />
      <FrameTile
        href="/proveedor/incidencias"
        icon={Siren}
        tone={frame.open_incidents ? "bad" : "ok"}
        label="Incidencias abiertas"
        value={frame.open_incidents}
        note={frame.open_incidents ? "Requieren seguimiento" : "Sin pendientes"}
        info="Incidencias abiertas o en proceso vinculadas a sus servicios o reportadas por su empresa."
        active={on("/proveedor/incidencias")}
      />
    </section>
  );
}
