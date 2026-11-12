"use client";

import { Bell, BookOpen, Clock, Download, FileSignature, Files, Mail, MessageCircle, Receipt, Route, ScrollText, Smartphone, Ticket } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { RichText } from "@/components/ui/RichText";
import { SidePanel } from "@/components/ui/SidePanel";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import type { PortalContentItem } from "@/lib/portal";
import { EmptyLine, PortalTitle, rise, RISE, SectionCard } from "./PortalUi";

export type PortalDocumentKind = "voucher" | "invoice" | "proposal" | "itinerary";

export interface PortalDocument {
  kind: PortalDocumentKind;
  code: string;
  label: string;
  date: string | null;
  status: string;
  version: number;
  reservation: string | null;
  ready: boolean;
  href: string | null;
}

export interface PortalDocumentList {
  contents: PortalContentItem[];
  items: PortalDocument[];
  kinds: { value: PortalDocumentKind; label: string; count: number }[];
}

const KIND_ICON: Record<PortalDocumentKind, typeof Ticket> = { voucher: Ticket, invoice: Receipt, proposal: FileSignature, itinerary: Route };

const KIND_TONE: Record<PortalDocumentKind, string> = { voucher: "text-t4", invoice: "text-t2", proposal: "text-t1", itinerary: "text-t3" };

export interface PortalNotification {
  id: string;
  event: string;
  channel: string;
  subject: string | null;
  body: string | null;
  at: string;
}

const CHANNEL_ICON: Record<string, typeof Mail> = { email: Mail, Email: Mail, whatsapp: MessageCircle, WhatsApp: MessageCircle, sms: Smartphone, SMS: Smartphone };

const KIND_LABEL: Record<PortalDocumentKind, string> = { voucher: "Voucher", invoice: "Comprobante", proposal: "Propuesta", itinerary: "Itinerario" };

export function PortalDocuments({ data }: { data: PortalDocumentList }) {
  const [kind, setKind] = useState<PortalDocumentKind | null>(null);
  const visible = kind ? data.items.filter((item) => item.kind === kind) : data.items;
  const groups = Object.entries(visible.reduce<Record<string, PortalDocument[]>>((acc, item) => {
    const key = item.reservation ?? "Sin reserva";
    return { ...acc, [key]: [...(acc[key] ?? []), item] };
  }, {}));

  return (
    <>
      <PortalTitle title="Documentos" subtitle="Vouchers, comprobantes, propuestas e itinerarios de tus viajes." />
      {data.kinds.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {[{ value: null, label: "Todos", count: data.items.length }, ...data.kinds].map((option) => {
            const Icon = option.value ? KIND_ICON[option.value] : Files;
            return (
              <button key={option.value ?? "todos"} type="button" onClick={() => setKind(option.value)} aria-pressed={kind === option.value} className={cn("lift inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition", kind === option.value ? "border-brand bg-brand text-brand-fg" : "border-line bg-surface text-fg-2 hover:text-fg")}>
                <Icon size={15} />
                {option.label}
                <span className={cn("rounded-full px-1.5 text-[11.5px]", kind === option.value ? "bg-white/20" : "bg-surface-2")}>{option.count}</span>
              </button>
            );
          })}
        </div>
      )}
      {groups.length === 0 ? (
        <EmptyLine>Los documentos aparecen cuando la agencia confirma tu viaje, emite un voucher o un comprobante.</EmptyLine>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map(([reservation, docs], index) => (
            <div key={reservation} className={RISE} style={rise(index)}>
              <SectionCard icon={Files} title={reservation === "Sin reserva" ? "Propuestas" : `Reserva ${reservation}`} aside={docs.length}>
                <ul className="flex flex-col gap-2">
                  {docs.map((doc) => {
                    const Icon = KIND_ICON[doc.kind];
                    return (
                      <li key={`${doc.kind}-${doc.code}`} className="lift flex items-center gap-3 rounded-tile border border-line bg-surface px-3 py-2.5">
                        <Icon size={16} className={cn("flex-none", KIND_TONE[doc.kind])} />
                        <span className="min-w-0 flex-1">
                          <b className="block truncate text-[13px] font-semibold">{doc.label}</b>
                          <span className="text-[12px] text-fg-3">
                            {KIND_LABEL[doc.kind]} {doc.kind === "invoice" || doc.kind === "itinerary" ? "" : doc.code}
                            {doc.date ? ` · ${formatDate(doc.date)}` : ""}
                            {doc.version > 1 ? ` · versión ${doc.version}` : ""}
                          </span>
                        </span>
                        {doc.ready && doc.href ? (
                          <a href={doc.href} target="_blank" rel="noreferrer" className="inline-flex h-8 flex-none items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-semibold text-t1 transition hover:bg-surface-2">
                            <Download size={14} /> Ver
                          </a>
                        ) : (
                          <span title="Estamos preparando el PDF. Vuelve en unos minutos." className="inline-flex h-8 flex-none items-center gap-1.5 px-2.5 text-[12px] text-fg-3">
                            <Clock size={13} /> Preparando
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
                {reservation !== "Sin reserva" && (
                  <Link href={`/portal/viajes/${encodeURIComponent(reservation)}`} className="mt-3 inline-block text-[12.5px] font-semibold text-accent hover:underline">
                    Ver el viaje
                  </Link>
                )}
              </SectionCard>
            </div>
          ))}
        </div>
      )}
      {data.contents.length > 0 && (
        <div className={cn("mt-5", RISE)} style={rise(groups.length)}>
          <SectionCard icon={BookOpen} title="Información de la agencia" aside={data.contents.length}>
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.contents.map((content) => (
                <li key={content.code}>
                  <ContentReader content={content} />
                </li>
              ))}
            </ul>
          </SectionCard>
        </div>
      )}
    </>
  );
}

function ContentReader({ content }: { content: PortalContentItem }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="lift flex w-full items-center gap-3 rounded-tile border border-line bg-surface px-3 py-2.5 text-left transition hover:bg-surface-2">
        <ScrollText size={16} className="flex-none text-t3" />
        <span className="min-w-0 flex-1">
          <b className="block truncate text-[13px] font-semibold">{content.title}</b>
          <span className="text-[12px] text-fg-3">
            {content.type}
            {content.updated_at ? ` · ${formatDate(content.updated_at)}` : ""}
          </span>
        </span>
        <span className="flex-none text-[12.5px] font-semibold text-t1">Leer</span>
      </button>
      <SidePanel open={open} onOpenChange={setOpen} title={content.title} description={content.updated_at ? `Actualizado el ${formatDate(content.updated_at)}` : content.type}>
        <RichText body={content.body} size="sm" />
      </SidePanel>
    </>
  );
}

export function PortalNotifications({ items }: { items: PortalNotification[] }) {
  return (
    <>
      <PortalTitle title="Notificaciones" subtitle="Los últimos avisos que te envió la agencia por correo, WhatsApp o SMS." />
      {items.length === 0 ? (
        <EmptyLine>Todavía no tienes notificaciones.</EmptyLine>
      ) : (
        <ol className="relative grid gap-3 border-l-2 border-dashed border-line pl-5">
          {items.map((item, index) => {
            const Icon = CHANNEL_ICON[item.channel] ?? Bell;
            return (
              <li key={item.id} className={`lift relative rounded-card border border-line bg-surface p-4 shadow-card ${RISE}`} style={rise(index)}>
                <span className="absolute -left-[31px] top-4 grid h-5 w-5 place-items-center rounded-full border-2 border-surface bg-t1 text-white">
                  <Icon size={10} />
                </span>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <b className="text-[14px] font-semibold text-fg">{item.subject ?? item.event}</b>
                  <span className="text-[12px] text-fg-3">{formatDateTime(item.at)}</span>
                </div>
                {item.body && <p className="mt-1 line-clamp-3 whitespace-pre-line text-[13px] text-fg-2">{item.body}</p>}
              </li>
            );
          })}
        </ol>
      )}
    </>
  );
}
