import { AlarmClock, CircleCheckBig, Eye, Inbox, MessagesSquare, SearchX, Timer } from "lucide-react";
import { AuditPanelButton, type AuditEntry } from "@/features/audit/AuditTimeline";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { Composer, ThreadActions } from "@/features/inbox/InboxActions";
import { ChannelIcon, ContactCard, ConversationList, MessageBubble } from "@/features/inbox/InboxViews";
import { ConversationCrmActions } from "@/features/leads/ConversationCrmActions";
import { getRelatedOptions } from "@/lib/server/activities";
import { getAdvisors, getCatalogs } from "@/lib/server/leads";
import { ChannelAccountsPanel } from "@/features/inbox/ChannelAccountsPanel";
import { INBOX_SCOPE, type ChannelAccount, type ConversationThread, type InboxOverview } from "@/lib/inbox";
import { getResource } from "@/lib/server/resource";
import { currentUser } from "@/lib/server/me";

export const metadata: Metadata = { title: "Bandeja omnicanal" };

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const [{ c }, overview] = await Promise.all([searchParams, getResource<InboxOverview>("/inbox/conversations", "No pudimos cargar la bandeja.")]);

  if (!overview) {
    return <PageHeader title="Bandeja omnicanal" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const requested = c ? overview.items.find((item) => item.code === c) : undefined;
  const missing = Boolean(c) && !requested;
  const selected = requested ?? (missing ? undefined : overview.items.find((item) => item.status !== "resuelta") ?? overview.items[0]);
  const scope = INBOX_SCOPE[overview.scope ?? (overview.can.reassign ? "all" : "own")];
  const [thread, me, catalogs, advisors, activityOptions, channels, audit] = await Promise.all([
    selected ? getResource<ConversationThread>(`/inbox/conversations/${encodeURIComponent(selected.code)}`, "No pudimos abrir la conversación.") : Promise.resolve(null),
    currentUser(),
    overview.can.manage ? getCatalogs() : Promise.resolve(null),
    overview.can.manage ? getAdvisors() : Promise.resolve([]),
    overview.can.manage ? getRelatedOptions() : Promise.resolve(null),
    overview.can.manage ? getResource<ChannelAccount[]>("/inbox/channel-accounts", "No pudimos cargar los canales.") : Promise.resolve(null),
    selected ? getResource<AuditEntry[]>(`/inbox/conversations/${encodeURIComponent(selected.code)}/audit`, "No pudimos cargar la auditoría.") : Promise.resolve(null),
  ]);
  const { kpis } = overview;

  return (
    <>
      <PageHeader
        title="Bandeja omnicanal"
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            WhatsApp, correo, chat web, formularios y tickets del portal en una sola bandeja.
            <span title={scope.detail} className="inline-flex">
              <Badge tone="info" dot={false}>
                <Eye size={12} className="mr-1 inline" />
                {scope.label}
              </Badge>
            </span>
          </span>
        }
        actions={channels ? <ChannelAccountsPanel accounts={channels} /> : undefined}
        info={<InfoTip>Responder una conversación sin responsable te la asigna. Las notas internas nunca llegan al cliente.</InfoTip>}
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Inbox} tone="t1" label="Abiertas" value={kpis.open} note={`${kpis.unassigned} sin asignar`} info={<p>Conversaciones a tu alcance que esperan respuesta del equipo. La nota cuenta cuántas de ellas aún no tienen responsable.</p>} />
        <TintTile icon={AlarmClock} tone="bad" label="Primera respuesta vencida" value={kpis.sla_breached} note="Aún sin respuesta" info={<p>Conversaciones sin primera respuesta cuyo plazo por canal ya pasó.</p>} />
        <TintTile icon={Timer} tone="violet" label="Primera respuesta" value={kpis.first_response_minutes !== null ? `${kpis.first_response_minutes} min` : "Sin datos"} note="Promedio" info={<p>Minutos promedio entre el primer mensaje del cliente y la primera respuesta del equipo.</p>} />
        <TintTile icon={CircleCheckBig} tone="ok" label="Resueltas en 7 días" value={kpis.resolved_week} info={<p>Conversaciones marcadas como resueltas en los últimos 7 días.</p>} />
      </section>
      <section className="grid overflow-hidden rounded-card border border-line bg-surface shadow-card lg:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)_300px]">
        <ConversationList items={overview.items} selected={selected?.code ?? null} />
        {thread ? (
          <>
            <div className="flex min-h-[560px] min-w-0 flex-col">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-3.5">
                <div className="flex min-w-0 items-start gap-3">
                  <ChannelIcon channel={thread.channel} size={16} />
                  <div className="min-w-0">
                    <h2 className="truncate text-[15px] font-semibold">{thread.subject}</h2>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-fg-3">
                      <span>{thread.code}</span>
                      <StatusBadge status={thread.status} label={thread.status_label} />
                      <StatusBadge status={thread.priority} />
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {audit && <AuditPanelButton title={`Auditoría de ${thread.code}`} description="Quién respondió, asignó, vinculó o cambió el estado, con fecha e IP." entries={audit} />}
                  <ThreadActions thread={thread} agents={overview.agents} canReassign={overview.can.reassign} canManage={overview.can.manage} />
                </div>
              </header>
              <ol className="scroll-thin flex max-h-[520px] flex-1 flex-col gap-3 overflow-y-auto bg-[color-mix(in_srgb,var(--surface-2)_55%,var(--surface))] px-4 py-5">
                {thread.messages.map((message, index) => (
                  <MessageBubble key={message.id} message={message} index={index} conversation={thread.code} />
                ))}
              </ol>
              {overview.can.manage && <Composer thread={thread} templates={overview.templates} me={me.name} agency={overview.agency} />}
            </div>
            <div className="lg:col-span-2 2xl:col-span-1">
              <ContactCard thread={thread} canLink={overview.can.link ?? []} canQuote={overview.can.quote ?? false} />
              {overview.can.manage && <ConversationCrmActions thread={thread} catalogs={catalogs} advisors={advisors} activityOptions={activityOptions} />}
            </div>
          </>
        ) : (
          <div className="lg:col-span-2">
            {missing ? (
              <EmptyState icon={<SearchX size={22} />} title={`No encontramos la conversación ${c}`} description={`No existe o está fuera de tu alcance. ${scope.detail} Elige otra en la lista.`} />
            ) : (
              <EmptyState icon={<MessagesSquare size={22} />} title="No hay conversaciones" description="Cuando un cliente escriba por un canal conectado aparecerá aquí." />
            )}
          </div>
        )}
      </section>
    </>
  );
}
