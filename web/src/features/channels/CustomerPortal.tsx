"use client";

import { FileText, Heart, Home, Mail, MapPinned, Phone, Plane, ReceiptText, ScrollText, UserRound, Wallet, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import type { CustomerPortal, CustomerPortalPreview } from "@/lib/channels";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import { ChannelBadge, MoneyLines, UsageBar } from "./ChannelUi";

export const CUSTOMER_PREVIEW_SECTIONS: { id: string; label: string; icon: LucideIcon; key: keyof CustomerPortal | null }[] = [
  { id: "home", label: "Inicio", icon: Home, key: null },
  { id: "reservations", label: "Mis viajes", icon: MapPinned, key: "reservations" },
  { id: "quotes", label: "Propuestas", icon: ScrollText, key: "quotes" },
  { id: "receivables", label: "Pagos", icon: ReceiptText, key: "payments" },
  { id: "documents", label: "Documentos", icon: FileText, key: "documents" },
  { id: "wishlist", label: "Favoritos", icon: Heart, key: "wishlist" },
];

export function PortalFrame({ title, nav, children }: { title: string; nav?: ReactNode; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface-2/40 shadow-card">
      <div className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2.5">
        {["#f87171", "#fbbf24", "#34d399"].map((color) => (
          <span key={color} className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        ))}
        <span className="ml-2 text-[12.5px] font-semibold text-fg-3">Vista del canal · {title}</span>
      </div>
      {nav}
      <div className="p-5">{children}</div>
    </div>
  );
}

function Row({ index, children }: { index: number; children: ReactNode }) {
  return (
    <li style={{ animationDelay: `${index * 60}ms` }} className="lift flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] items-center justify-between gap-3 rounded-tile border border-line bg-surface px-3.5 py-2.5">
      {children}
    </li>
  );
}

function Section({ icon, title, count, empty, children }: { icon: typeof Plane; title: string; count: number; empty: string; children: ReactNode }) {
  return (
    <Card>
      <TintCardTitle icon={icon} title={title} aside={`${count}`} />
      {count === 0 ? <p className="text-[13px] text-fg-3">{empty}</p> : <ul className="flex flex-col gap-2">{children}</ul>}
    </Card>
  );
}

function TripsSection({ client }: { client: CustomerPortal }) {
  return (
    <Section icon={MapPinned} title="Mis viajes" count={client.reservations.length} empty="Aún no tiene viajes reservados.">
      {client.reservations.map((reservation, index) => (
        <Row key={reservation.code} index={index}>
          <span className="min-w-0 flex-1">
            <b className="block truncate text-[13.5px] font-semibold">{reservation.title}</b>
            <span className="text-[12px] text-fg-3">{formatDate(reservation.from)} – {formatDate(reservation.to)} · {reservation.passengers} pasajeros</span>
            <span className="mt-1.5 flex items-center gap-2" title={`${reservation.confirmed} de ${reservation.services} servicios confirmados`}>
              <UsageBar pct={reservation.services ? (reservation.confirmed / reservation.services) * 100 : 0} tone="ok" />
              <span className="flex-none text-[11.5px] text-fg-3">{reservation.confirmed}/{reservation.services}</span>
            </span>
          </span>
          <span className="flex flex-none flex-col items-end gap-1">
            <b className="text-[13px]">{formatMoney(reservation.total, reservation.currency)}</b>
            <ChannelBadge status={reservation.status} />
          </span>
        </Row>
      ))}
    </Section>
  );
}

function QuotesSection({ client }: { client: CustomerPortal }) {
  return (
    <Section icon={ScrollText} title="Propuestas" count={client.quotes.length} empty="No hay propuestas enviadas.">
      {client.quotes.map((quote, index) => (
        <Row key={quote.code} index={index}>
          <span className="min-w-0">
            <b className="block truncate text-[13.5px] font-semibold">{quote.title}</b>
            <span className="text-[12px] text-fg-3">{quote.code} · versión {quote.version}{quote.valid_until ? ` · vence ${formatDate(quote.valid_until)}` : ""}</span>
          </span>
          <span className="flex flex-none flex-col items-end gap-1">
            {quote.total !== null && <b className="text-[13px]">{formatMoney(quote.total, quote.currency)}</b>}
            <ChannelBadge status={quote.expired ? "vencida" : quote.status} />
          </span>
        </Row>
      ))}
    </Section>
  );
}

function PaymentsSection({ client }: { client: CustomerPortal }) {
  return (
    <Section icon={ReceiptText} title="Pagos" count={client.payments.length} empty="No tiene cuotas por pagar.">
      {client.payments.map((payment, index) => (
        <Row key={payment.code} index={index}>
          <span className="min-w-0">
            <b className="block truncate text-[13.5px] font-semibold">{payment.concept}</b>
            <span className="text-[12px] text-fg-3">{payment.reservation} · vence {formatDate(payment.due_date)}</span>
          </span>
          <span className="flex flex-none flex-col items-end gap-1">
            <b className="text-[13px]">{payment.balance > 0 ? `Saldo ${formatMoney(payment.balance, payment.currency)}` : formatMoney(payment.amount, payment.currency)}</b>
            <ChannelBadge status={payment.status} />
          </span>
        </Row>
      ))}
    </Section>
  );
}

function DocumentsSection({ client }: { client: CustomerPortal }) {
  return (
    <Section icon={FileText} title="Documentos" count={client.documents.length} empty="Los vouchers aparecen al confirmar cada servicio.">
      {client.documents.map((document, index) => (
        <Row key={document.code} index={index}>
          <span className="min-w-0">
            <b className="block truncate text-[13px] font-semibold">{document.label}</b>
            <span className="text-[12px] text-fg-3">{document.code} · v{document.version} · {formatDate(document.date)}</span>
          </span>
          <ChannelBadge status={document.status} />
        </Row>
      ))}
    </Section>
  );
}

function WishlistSection({ client }: { client: CustomerPortal }) {
  return (
    <Section icon={Heart} title="Favoritos" count={client.wishlist.length} empty="Sin productos guardados.">
      {client.wishlist.map((product, index) => (
        <Row key={product.code} index={index}>
          <span className="truncate text-[13px] font-medium">{product.name}</span>
          <Heart size={14} className="flex-none fill-[var(--bad)] text-bad" />
        </Row>
      ))}
    </Section>
  );
}

function AdvisorCard({ client }: { client: CustomerPortal }) {
  return (
    <Card>
      <TintCardTitle icon={UserRound} title="Tu asesor" />
      {client.advisor ? (
        <div className="flex flex-col gap-1.5 text-[13px]">
          <b className="text-[14px] font-semibold">{client.advisor.name}</b>
          <span className="flex items-center gap-1.5 text-fg-2"><Mail size={13} /> {client.advisor.email}</span>
          {client.advisor.phone && <span className="flex items-center gap-1.5 text-fg-2"><Phone size={13} /> {client.advisor.phone}</span>}
        </div>
      ) : (
        <p className="text-[13px] text-fg-3">Sin asesor asignado.</p>
      )}
    </Card>
  );
}

const SECTION_VIEWS: Partial<Record<string, (props: { client: CustomerPortal }) => ReactNode>> = {
  reservations: TripsSection,
  quotes: QuotesSection,
  receivables: PaymentsSection,
  documents: DocumentsSection,
  wishlist: WishlistSection,
};

function Greeting({ client }: { client: CustomerPortal }) {
  return (
    <div>
      <p className="text-[22px] font-bold tracking-tight">Hola, {client.name.split(" ")[0]}</p>
      <p className="text-[13px] text-fg-3">{client.email ?? "Sin correo"}{client.country ? ` · ${client.country}` : ""}</p>
    </div>
  );
}

function Portal({ client }: { client: CustomerPortal }) {
  const next = client.kpis.next_trip;
  return (
    <div className="flex flex-col gap-5">
      <Greeting client={client} />
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TintTile icon={Plane} tone="t1" label="Próximo viaje" value={next ? formatDate(next.from) : "Sin viajes"} note={next?.title ?? "Planifica el siguiente"} />
        <TintTile icon={ScrollText} tone="violet" label="Propuestas por responder" value={client.kpis.awaiting_quotes} note="Enviadas por tu asesor" />
        <TintTile icon={Wallet} tone="sun" label="Saldo pendiente" value={<MoneyLines values={client.kpis.balance} empty="Al día" />} note="Puedes pagar en partes" />
        <TintTile icon={FileText} tone="t4" label="Documentos" value={client.kpis.documents} note="Vouchers listos" />
      </section>
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-5">
          <TripsSection client={client} />
          <QuotesSection client={client} />
          <PaymentsSection client={client} />
        </div>
        <div className="flex flex-col gap-5">
          <AdvisorCard client={client} />
          <DocumentsSection client={client} />
          <WishlistSection client={client} />
        </div>
      </div>
    </div>
  );
}

function PreviewNav({ client, section }: { client: CustomerPortal; section: string }) {
  return (
    <nav aria-label="Secciones del portal" className="scroll-thin flex gap-1 overflow-x-auto border-b border-line bg-surface px-3 py-2">
      {CUSTOMER_PREVIEW_SECTIONS.map((item) => {
        const Icon = item.icon;
        const active = item.id === section;
        const count = item.key ? (client[item.key] as unknown[]).length : null;
        return (
          <Link
            key={item.id}
            href={`?cliente=${encodeURIComponent(client.code)}${item.id === "home" ? "" : `&seccion=${item.id}`}`}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={cn("group flex h-9 flex-none items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold transition", active ? "bg-[color-mix(in_srgb,var(--accent)_12%,var(--surface))] text-accent" : "text-fg-2 hover:bg-surface-2 hover:text-fg")}
          >
            <Icon size={15} className="transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110" />
            {item.label}
            {count !== null && count > 0 && <span className={cn("grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px]", active ? "bg-accent text-white" : "bg-surface-2 text-fg-2")}>{count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function CustomerPortalView({ preview, section = "home" }: { preview: CustomerPortalPreview; section?: string }) {
  if (!preview.client) {
    return <Card><EmptyState icon={<UserRound size={22} />} title="Sin clientes con viajes o propuestas" description="Cuando un cliente tenga una reserva o una propuesta enviada, podrás ver aquí su portal." /></Card>;
  }
  const View = SECTION_VIEWS[section];
  return (
    <PortalFrame title="Portal del cliente" nav={<PreviewNav client={preview.client} section={View ? section : "home"} />}>
      {View ? (
        <div className="flex flex-col gap-5">
          <Greeting client={preview.client} />
          <View client={preview.client} />
        </div>
      ) : (
        <Portal client={preview.client} />
      )}
    </PortalFrame>
  );
}
