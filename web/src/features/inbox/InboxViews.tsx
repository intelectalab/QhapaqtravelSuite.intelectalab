"use client";

import { FilePlus2, Globe, Mail, MessageCircle, MessagesSquare, Paperclip, Search, StickyNote, TicketCheck, FileText } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { formatDateTime, formatMoney, normalize } from "@/lib/format";
import { CHANNEL_TONES, LINK_KINDS, SLA_STATE, type ConversationSummary, type ConversationThread, type LinkKind } from "@/lib/inbox";
import { ConversationLinkAction, ConversationUnlinkAction } from "./InboxActions";
import { toneStyle } from "@/lib/tone";

const CHANNEL_ICONS: Record<string, typeof Mail> = { whatsapp: MessageCircle, email: Mail, webchat: MessagesSquare, form: FileText, portal: TicketCheck };

const FILTERS = [
  { id: "active", label: "Activas" },
  { id: "mine", label: "Mías" },
  { id: "unassigned", label: "Sin asignar" },
  { id: "resuelta", label: "Resueltas" },
] as const;

export function ChannelIcon({ channel, size = 15 }: { channel: string; size?: number }) {
  const Icon = CHANNEL_ICONS[channel] ?? Globe;
  return (
    <span style={toneStyle(CHANNEL_TONES[channel] ?? "mute")} className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-[color-mix(in_srgb,var(--tint)_14%,transparent)] text-[var(--tint)]">
      <Icon size={size} />
    </span>
  );
}

export function ConversationList({ items, selected }: { items: ConversationSummary[]; selected: string | null }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("active");
  const [query, setQuery] = useState("");
  const visible = useMemo(() => {
    const needle = normalize(query);
    return items.filter((item) => {
      const matches = filter === "active" ? item.status !== "resuelta" : filter === "mine" ? item.mine : filter === "unassigned" ? item.assignee === null && item.status !== "resuelta" : item.status === "resuelta";
      return matches && (needle === "" || normalize(`${item.contact.name} ${item.subject} ${item.code} ${item.tags.join(" ")}`).includes(needle));
    });
  }, [items, filter, query]);

  return (
    <aside className="flex min-h-0 flex-col border-line lg:border-r">
      <div className="border-b border-line p-3">
        <label className="flex h-10 items-center gap-2 rounded-control border border-line bg-surface px-3 focus-within:border-accent">
          <Search size={15} className="text-fg-3" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar contacto o asunto" className="min-w-0 flex-1 bg-transparent text-[13.5px] outline-none placeholder:text-fg-3" />
        </label>
        <div className="mt-2.5 flex gap-1 rounded-control bg-surface-2 p-1">
          {FILTERS.map((option) => (
            <button key={option.id} type="button" onClick={() => setFilter(option.id)} className={cn("flex-1 rounded-[9px] px-2 py-1.5 text-[12px] font-semibold transition", filter === option.id ? "bg-surface text-fg shadow-card" : "text-fg-3 hover:text-fg")}>
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <ul className="scroll-thin max-h-[640px] flex-1 overflow-y-auto">
        {visible.length === 0 && <li className="px-4 py-10 text-center text-[13px] text-fg-3">No hay conversaciones con este filtro.</li>}
        {visible.map((item, index) => (
          <li key={item.code} style={{ animationDelay: `${index * 40}ms` }} className="animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
            <Link
              href={`/inbox?c=${item.code}`}
              scroll={false}
              className={cn("group flex gap-3 border-b border-line-2 px-3.5 py-3 transition-colors hover:bg-surface-2", selected === item.code && "bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface))] shadow-[inset_3px_0_0_var(--accent)]")}
            >
              <ChannelIcon channel={item.channel} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <b className={cn("truncate text-[13.5px]", item.unread > 0 ? "font-bold" : "font-semibold")}>{item.contact.name}</b>
                  <span className="flex-none text-[11px] text-fg-3">{formatDateTime(item.last_message_at, false)}</span>
                </span>
                <span className="block truncate text-[12.5px] text-fg-2">{item.subject}</span>
                {item.preview && <span className="mt-0.5 block truncate text-[12px] text-fg-3">{item.preview_inbound ? "" : "Tú: "}{item.preview}</span>}
                <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  {item.unread > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[10.5px] font-bold text-white">{item.unread}</span>}
                  {item.sla.state === "breached" && <Badge tone="bad">Fuera de plazo</Badge>}
                  {(item.priority === "alta" || item.priority === "critica") && <StatusBadge status={item.priority} />}
                  {item.assignee === null && item.status !== "resuelta" && <Badge tone="warn" dot={false}>Sin asignar</Badge>}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export function MessageBubble({ message, index }: { message: ConversationThread["messages"][number]; index: number }) {
  if (message.direction === "system") {
    return <li className="py-1 text-center text-[11.5px] text-fg-3">{message.body} · {formatDateTime(message.at, false)}</li>;
  }
  const outbound = message.direction === "out";
  const note = message.direction === "internal";
  return (
    <li style={{ animationDelay: `${index * 50}ms` }} className={cn("flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] gap-2.5", outbound || note ? "flex-row-reverse" : "")}>
      <Avatar name={message.author} size="sm" />
      <div className={cn("max-w-[78%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed shadow-card transition-transform duration-200 hover:-translate-y-0.5", outbound ? "rounded-tr-md bg-accent text-white" : note ? "rounded-tr-md border border-dashed border-warn/50 bg-[color-mix(in_srgb,var(--warn)_10%,var(--surface))]" : "rounded-tl-md border border-line bg-surface")}>
        {note && (
          <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-warn">
            <StickyNote size={12} /> Nota interna
          </p>
        )}
        <p className="whitespace-pre-line">{message.body}</p>
        {message.files.map((file) => (
          <p key={file.name} className={cn("mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px]", outbound ? "bg-white/15" : "bg-surface-2")}>
            <Paperclip size={12} /> {file.name} · {Math.round(file.size / 1024)} KB
          </p>
        ))}
        <p className={cn("mt-1 text-[11px]", outbound ? "text-white/75" : "text-fg-3")}>
          {message.author} · {formatDateTime(message.at, false)}
          {message.delivery && outbound ? ` · ${message.delivery}` : ""}
        </p>
      </div>
    </li>
  );
}

export function ContactCard({ thread, canLink = [], canQuote = false }: { thread: ConversationThread; canLink?: LinkKind[]; canQuote?: boolean }) {
  const { card } = thread;
  const links: { kind: LinkKind; code: string | null; title: string; detail: string; status: string | null }[] = [
    { kind: "client", code: card.client?.code ?? null, title: card.client?.name ?? "", detail: card.client ? [card.client.segment, card.client.country, card.client.nps !== null ? `NPS ${card.client.nps}` : null].filter(Boolean).join(" · ") : "", status: null },
    { kind: "lead", code: card.lead?.code ?? null, title: card.lead?.name ?? "", detail: card.lead?.code ?? "", status: card.lead?.status ?? null },
    { kind: "reservation", code: card.reservation?.code ?? null, title: card.reservation?.title ?? "", detail: card.reservation?.code ?? "", status: card.reservation?.status ?? null },
  ];
  const others = card.reservations.filter((item) => item.code !== card.reservation?.code);
  const sla = SLA_STATE[thread.sla.state];
  return (
    <aside className="flex flex-col gap-4 border-line p-4 lg:border-l">
      <div className="flex items-center gap-3">
        <Avatar name={thread.contact.name} size="md" solid />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold">{thread.contact.name}</p>
          <p className="truncate text-[12px] text-fg-3">{thread.contact.email ?? thread.contact.phone ?? "Sin datos de contacto"}</p>
        </div>
      </div>
      <dl className="rounded-xl bg-surface-2 px-3 py-1 text-[12.5px]">
        <div className="flex justify-between border-b border-line-2 py-2">
          <dt className="text-fg-3">Canal</dt>
          <dd className="font-medium">{thread.channel_label}</dd>
        </div>
        <div className="flex justify-between border-b border-line-2 py-2">
          <dt className="text-fg-3">Primera respuesta</dt>
          <dd><Badge tone={sla.tone} dot={false}>{sla.label}</Badge></dd>
        </div>
        <div className="flex justify-between py-2">
          <dt className="text-fg-3">Responsable</dt>
          <dd className="font-medium">{thread.assignee?.name ?? "Sin asignar"}</dd>
        </div>
      </dl>
      {links.map(({ kind, code, title, detail, status }) =>
        code || canLink.includes(kind) ? (
          <section key={kind}>
            <p className="mb-1.5 text-[12px] font-semibold text-fg-3">{LINK_KINDS[kind].label}</p>
            {code ? (
              <div className="flex items-center gap-1.5">
                <Link href={LINK_KINDS[kind].href(code)} className="lift min-w-0 flex-1 rounded-xl border border-line px-3 py-2.5 hover:border-accent/40">
                  <span className="flex items-center justify-between gap-2">
                    <b className="truncate text-[13px]">{title}</b>
                    {status && <StatusBadge status={status} />}
                  </span>
                  <span className="block truncate text-[12px] text-fg-3">{detail}</span>
                </Link>
                {canLink.includes(kind) && (
                  <span className="flex flex-col gap-1">
                    <ConversationLinkAction thread={thread} kind={kind} linked />
                    <ConversationUnlinkAction thread={thread} kind={kind} code={code} />
                  </span>
                )}
              </div>
            ) : (
              <ConversationLinkAction thread={thread} kind={kind} linked={false} />
            )}
          </section>
        ) : null,
      )}
      {others.length > 0 && (
        <section>
          <p className="mb-1.5 text-[12px] font-semibold text-fg-3">Otras reservas del cliente</p>
          <ul className="flex flex-col gap-1.5">
            {others.map((item) => (
              <li key={item.code}>
                <Link href={`/reservas/${item.code}`} className={cn("lift block rounded-xl border px-3 py-2 hover:border-accent/40", item.linked ? "border-accent/40" : "border-line")}>
                  <span className="flex items-center justify-between gap-2 text-[12.5px] font-semibold">
                    {item.code}
                    <StatusBadge status={item.status} />
                  </span>
                  <span className="block truncate text-[12px] text-fg-3">{item.title} · {formatMoney(item.total, item.currency)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {(card.quotes.length > 0 || canQuote) && (
        <section>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="text-[12px] font-semibold text-fg-3">Cotizaciones</p>
            {canQuote && (
              <Button href={card.opportunity ? `/cotizaciones/nueva?oportunidad=${encodeURIComponent(card.opportunity.code)}` : "/cotizaciones/nueva"} variant="secondary" size="sm" icon={<FilePlus2 size={14} />}>
                Crear cotización
              </Button>
            )}
          </div>
          {canQuote && card.opportunity && <p className="mb-1.5 truncate text-[12px] text-fg-3">Para la oportunidad {card.opportunity.code} · {card.opportunity.title}</p>}
          {card.quotes.length === 0 && <p className="text-[12.5px] text-fg-3">El cliente aún no tiene cotizaciones.</p>}
          <ul className="flex flex-col gap-1.5">
            {card.quotes.map((item) => (
              <li key={item.code}>
                <Link href={`/cotizaciones/${item.code}`} className={cn("lift block rounded-xl border px-3 py-2 hover:border-accent/40", item.linked ? "border-accent/40" : "border-line")}>
                  <span className="flex items-center justify-between gap-2 text-[12.5px] font-semibold">
                    {item.code}
                    <StatusBadge status={item.status} />
                  </span>
                  <span className="block truncate text-[12px] text-fg-3">{item.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
