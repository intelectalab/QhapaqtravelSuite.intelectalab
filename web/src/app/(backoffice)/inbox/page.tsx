import { AlarmClock, CircleCheckBig, Inbox, MessagesSquare, Timer, UserX } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { Composer, ThreadActions } from "@/features/inbox/InboxActions";
import { ChannelIcon, ContactCard, ConversationList, MessageBubble } from "@/features/inbox/InboxViews";
import type { ConversationThread, InboxOverview } from "@/lib/inbox";
import { getResource } from "@/lib/server/resource";
import { currentUser } from "@/lib/server/me";

export const metadata: Metadata = { title: "Bandeja omnicanal" };

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const [{ c }, overview] = await Promise.all([searchParams, getResource<InboxOverview>("/inbox/conversations", "No pudimos cargar la bandeja.")]);

  if (!overview) {
    return <PageHeader title="Bandeja omnicanal" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const selected = overview.items.find((item) => item.code === c) ?? overview.items.find((item) => item.status !== "resuelta") ?? overview.items[0];
  const [thread, me] = await Promise.all([
    selected ? getResource<ConversationThread>(`/inbox/conversations/${encodeURIComponent(selected.code)}`, "No pudimos abrir la conversación.") : Promise.resolve(null),
    currentUser(),
  ]);
  const { kpis } = overview;

  return (
    <>
      <PageHeader
        title="Bandeja omnicanal"
        subtitle="WhatsApp, correo, chat web, formularios y tickets del portal en una sola bandeja."
        info={<InfoTip>Responder una conversación sin responsable te la asigna. Las notas internas nunca llegan al cliente.</InfoTip>}
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Inbox} tone="t1" label="Abiertas" value={kpis.open} note={`${kpis.unassigned} sin asignar`} />
        <TintTile icon={AlarmClock} tone="bad" label="Primera respuesta vencida" value={kpis.sla_breached} note="Aún sin respuesta" />
        <TintTile icon={Timer} tone="violet" label="Primera respuesta" value={kpis.first_response_minutes !== null ? `${kpis.first_response_minutes} min` : "Sin datos"} note="Promedio" />
        <TintTile icon={CircleCheckBig} tone="ok" label="Resueltas en 7 días" value={kpis.resolved_week} />
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
                      {thread.tags.map((tag) => (
                        <Badge key={tag} tone="mute" dot={false}>
                          {tag}
                        </Badge>
                      ))}
                    </p>
                  </div>
                </div>
                <ThreadActions thread={thread} agents={overview.agents} canReassign={overview.can.reassign} canManage={overview.can.manage} />
              </header>
              <ol className="scroll-thin flex max-h-[520px] flex-1 flex-col gap-3 overflow-y-auto bg-[color-mix(in_srgb,var(--surface-2)_55%,var(--surface))] px-4 py-5">
                {thread.messages.map((message, index) => (
                  <MessageBubble key={message.id} message={message} index={index} />
                ))}
              </ol>
              {overview.can.manage && <Composer thread={thread} templates={overview.templates} me={me.name} />}
            </div>
            <div className="lg:col-span-2 2xl:col-span-1">
              <ContactCard thread={thread} />
            </div>
          </>
        ) : (
          <div className="lg:col-span-2">
            <EmptyState icon={<MessagesSquare size={22} />} title="No hay conversaciones" description="Cuando un cliente escriba por un canal conectado aparecerá aquí." />
          </div>
        )}
      </section>
      {overview.items.length > 0 && overview.agents.length === 0 && !overview.can.reassign && (
        <p className="mt-3 flex items-center gap-1.5 text-[12.5px] text-fg-3">
          <UserX size={14} /> Ves las conversaciones asignadas a ti y las que aún no tienen responsable.
        </p>
      )}
    </>
  );
}
