"use client";

import { Bell, Mail, MessageCircle, Smartphone, Ticket } from "lucide-react";
import Link from "next/link";
import { formatDate, formatDateTime } from "@/lib/format";
import { EmptyLine, PortalBadge, PortalTitle, rise, RISE, SectionCard } from "./PortalUi";

export interface PortalDocument {
  code: string;
  label: string;
  date: string;
  status: string;
  version: number;
  reservation: string;
}

export interface PortalNotification {
  id: string;
  event: string;
  channel: string;
  subject: string | null;
  body: string | null;
  at: string;
}

const CHANNEL_ICON: Record<string, typeof Mail> = { email: Mail, Email: Mail, whatsapp: MessageCircle, WhatsApp: MessageCircle, sms: Smartphone, SMS: Smartphone };

export function PortalDocuments({ items }: { items: PortalDocument[] }) {
  const groups = Object.entries(items.reduce<Record<string, PortalDocument[]>>((acc, item) => ({ ...acc, [item.reservation]: [...(acc[item.reservation] ?? []), item] }), {}));
  return (
    <>
      <PortalTitle title="Documentos" subtitle="Vouchers de todos tus viajes, agrupados por reserva." />
      {groups.length === 0 ? (
        <EmptyLine>Los vouchers aparecen cuando la agencia confirma cada servicio.</EmptyLine>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {groups.map(([reservation, docs], index) => (
            <div key={reservation} className={RISE} style={rise(index)}>
              <SectionCard icon={Ticket} title={`Reserva ${reservation}`} aside={docs.length}>
                <ul className="flex flex-col gap-2">
                  {docs.map((doc) => (
                    <li key={doc.code} className="lift flex items-center gap-3 rounded-tile border border-line bg-surface px-3 py-2.5">
                      <Ticket size={16} className="flex-none text-t4" />
                      <span className="min-w-0 flex-1">
                        <b className="block truncate text-[13px] font-semibold">{doc.label}</b>
                        <span className="text-[12px] text-fg-3">
                          Voucher {doc.code} · {formatDate(doc.date)}
                          {doc.version > 1 ? ` · versión ${doc.version}` : ""}
                        </span>
                      </span>
                      <PortalBadge status={doc.status} />
                    </li>
                  ))}
                </ul>
                <Link href={`/portal/viajes/${encodeURIComponent(reservation)}`} className="mt-3 inline-block text-[12.5px] font-semibold text-accent hover:underline">
                  Ver el viaje
                </Link>
              </SectionCard>
            </div>
          ))}
        </div>
      )}
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
