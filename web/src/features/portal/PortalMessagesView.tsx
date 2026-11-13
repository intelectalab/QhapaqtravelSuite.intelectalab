"use client";

import { MessageCirclePlus, MessagesSquare, Send } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PanelAction, type PanelActionState } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { sendMessage } from "@/app/(portal)/portal/actions";
import { FormError } from "@/features/auth/AuthForms";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { MESSAGE_TOPICS, type PortalConversation, type PortalMessages } from "@/lib/portal";
import { AdvisorCard, EmptyLine, PortalBadge, PortalTitle, RISE, rise } from "./PortalUi";

const initial: PanelActionState = { message: null, done: false };

const PRIORITIES = [
  { value: "media", label: "Normal" },
  { value: "alta", label: "Alta" },
  { value: "baja", label: "Baja" },
];

function NewMessage({ data, passenger }: { data: PortalMessages; passenger: boolean }) {
  return (
    <PanelAction label="Nuevo mensaje" icon={<MessageCirclePlus size={16} />} variant="primary" title="Escribir a la agencia" description={data.advisor ? `Le llega a ${data.advisor.name} y al equipo de la agencia.` : "Le llega al equipo de la agencia."} submitLabel="Enviar mensaje" action={sendMessage} initial={initial}>
      {() => (
        <>
          {passenger ? (
            <SelectField label="Tema" name="topic" defaultValue="general" options={MESSAGE_TOPICS} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Tema" name="topic" defaultValue="general" options={MESSAGE_TOPICS} />
              <SelectField label="Prioridad" name="priority" defaultValue="media" options={PRIORITIES} hint="Salud se atiende siempre con prioridad alta." />
            </div>
          )}
          {!passenger && data.trips.length > 0 && <SelectField label="Viaje" name="trip" placeholder="Sin viaje en particular" options={data.trips.map((trip) => ({ value: trip.code, label: trip.title }))} />}
          <TextField label="Asunto" name="subject" maxLength={180} placeholder="Opcional" />
          <TextArea label="Mensaje" name="body" rows={6} required minLength={2} maxLength={2000} />
        </>
      )}
    </PanelAction>
  );
}

function Reply({ conversation }: { conversation: PortalConversation }) {
  const form = useRef<HTMLFormElement>(null);
  const [state, run, pending] = useActionState(sendMessage, initial);
  useEffect(() => {
    if (state.done) form.current?.reset();
  }, [state]);
  return (
    <form ref={form} action={run} className="flex flex-col gap-2 border-t border-line pt-4">
      <FormError message={state.done ? null : state.message} />
      <input type="hidden" name="conversation" value={conversation.code} />
      <TextArea label="Responder" name="body" rows={3} required minLength={2} maxLength={2000} placeholder="Escribe tu mensaje" />
      <div className="flex justify-end">
        <Button type="submit" variant="primary" icon={<Send size={15} />} disabled={pending}>
          {pending ? "Enviando…" : "Enviar"}
        </Button>
      </div>
    </form>
  );
}

function Thread({ conversation, clientName }: { conversation: PortalConversation; clientName: string }) {
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [conversation.messages.length]);
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <b className="block text-[16px] font-semibold leading-snug">{conversation.subject}</b>
          <span className="text-[12.5px] text-fg-3">
            {conversation.assignee ? `Te atiende ${conversation.assignee}` : "Te atiende el equipo de la agencia"}
            {conversation.reservation ? ` · ${conversation.reservation}` : ""}
          </span>
        </div>
        <PortalBadge status={conversation.status} scope="message" />
      </div>
      <div className="scroll-thin flex max-h-[460px] flex-col gap-3 overflow-y-auto pr-1">
        {conversation.messages.map((message, index) => (
          <div key={`${message.at}-${index}`} style={rise(index)} className={cn("flex items-end gap-2", message.mine ? "flex-row-reverse" : "", RISE)}>
            <Avatar name={message.mine ? clientName : (message.author ?? "Agencia")} size="xs" solid={!message.mine} />
            <div className={cn("max-w-[78%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed shadow-card", message.mine ? "rounded-br-md bg-t1 text-white" : "rounded-bl-md border border-line bg-surface")}>
              {!message.mine && message.author && <b className="mb-0.5 block text-[12px] font-semibold text-t1">{message.author}</b>}
              <p className="whitespace-pre-line">{message.body}</p>
              <span className={cn("mt-1 block text-[11px]", message.mine ? "text-white/70" : "text-fg-3")}>{formatDateTime(message.at)}</span>
            </div>
          </div>
        ))}
        <div ref={end} />
      </div>
      <Reply conversation={conversation} />
    </Card>
  );
}

export function PortalMessagesView({ data, passenger, clientName }: { data: PortalMessages; passenger: boolean; clientName: string }) {
  const [selected, setSelected] = useState(data.conversations[0]?.code ?? null);
  const current = data.conversations.find((conversation) => conversation.code === selected) ?? data.conversations[0] ?? null;

  return (
    <>
      <PortalTitle title="Mensajes" subtitle="Conversa con tu agencia sobre tu viaje, tus pagos o cualquier cambio." actions={<NewMessage data={data} passenger={passenger} />} />
      <div className="grid items-start gap-5 xl:grid-cols-[320px_minmax(0,1fr)_300px]">
        <Card padded={false} className="overflow-hidden">
          <p className="flex items-center gap-2 border-b border-line px-4 py-3 text-[13.5px] font-semibold">
            <MessagesSquare size={16} className="text-t1" /> Conversaciones
          </p>
          {data.conversations.length === 0 ? (
            <div className="p-4">
              <EmptyLine>Aún no tienes conversaciones.</EmptyLine>
            </div>
          ) : (
            <ul className="flex flex-col">
              {data.conversations.map((conversation, index) => {
                const last = conversation.messages[conversation.messages.length - 1];
                const active = conversation.code === current?.code;
                return (
                  <li key={conversation.code} style={rise(index)} className={RISE}>
                    <button type="button" onClick={() => setSelected(conversation.code)} className={cn("flex w-full flex-col gap-1 border-b border-line px-4 py-3 text-left transition last:border-b-0 hover:bg-surface-2", active && "bg-[color-mix(in_srgb,var(--t1)_8%,var(--surface))]")}>
                      <span className="flex items-center justify-between gap-2">
                        <b className={cn("truncate text-[13.5px] font-semibold", active && "text-t1")}>{conversation.subject}</b>
                        <span className="flex-none text-[11px] text-fg-3">{formatDateTime(conversation.last_message_at, false)}</span>
                      </span>
                      {last && <span className="line-clamp-1 text-[12.5px] text-fg-3">{last.mine ? "Tú: " : ""}{last.body}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        {current ? <Thread key={current.code} conversation={current} clientName={clientName} /> : <Card><EmptyLine>Escribe tu primer mensaje con el botón Nuevo mensaje.</EmptyLine></Card>}
        <AdvisorCard advisor={data.advisor} />
      </div>
    </>
  );
}
