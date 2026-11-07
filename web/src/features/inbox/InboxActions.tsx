"use client";

import { CheckCheck, Hand, Lock, RotateCcw, Send, Tags, UserRoundCog } from "lucide-react";
import { useActionState, useState } from "react";
import { conversationStep, replyConversation } from "@/app/(backoffice)/inbox/actions";
import { FormError } from "@/features/auth/AuthForms";
import { Button } from "@/components/ui/Button";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { PRIORITY_OPTIONS, type ConversationThread, type ReplyTemplate } from "@/lib/inbox";
import type { StepResult } from "@/lib/server/resource";

const initial: StepResult = { message: null, done: false };

function fill(body: string, thread: ConversationThread, me: string) {
  const reservation = thread.card.reservations.find((item) => item.linked) ?? thread.card.reservations[0];
  const quote = thread.card.quotes.find((item) => item.linked) ?? thread.card.quotes[0];
  return body
    .replaceAll("{{nombre}}", thread.contact.name.split(" ")[0])
    .replaceAll("{{asesor}}", me)
    .replaceAll("{{cotizacion}}", quote?.code ?? "")
    .replaceAll("{{reserva}}", reservation?.code ?? "");
}

function StepFields({ thread, step }: { thread: ConversationThread; step: string }) {
  return (
    <>
      <input type="hidden" name="code" value={thread.code} />
      <input type="hidden" name="step" value={step} />
      <input type="hidden" name="lock_version" value={thread.lock_version} />
    </>
  );
}

export function QuickStep({ thread, step, label, icon }: { thread: ConversationThread; step: "resolve" | "reopen"; label: string; icon: React.ReactNode }) {
  const [state, run, pending] = useActionState(conversationStep, initial);
  return (
    <form action={run} className="flex items-center gap-2">
      <StepFields thread={thread} step={step} />
      <Button type="submit" size="sm" variant="secondary" icon={icon} disabled={pending}>
        {pending ? "Un momento…" : label}
      </Button>
      {state.message && <span className="text-[12px] text-bad">{state.message}</span>}
    </form>
  );
}

export function ThreadActions({ thread, agents, canReassign, canManage }: { thread: ConversationThread; agents: { id: string; name: string }[]; canReassign: boolean; canManage: boolean }) {
  if (!canManage) return null;
  const resolved = thread.status === "resuelta";
  return (
    <div className="flex flex-wrap items-center gap-2">
      {!thread.mine && !canReassign && (
        <PanelAction<StepResult> label="Tomar" icon={<Hand size={15} />} size="sm" formId={`tomar-${thread.code}`} title="Tomar conversación" description="Quedará asignada a ti y la verás en tus pendientes." submitLabel="Tomarla" action={conversationStep} initial={initial}>
          {() => (
            <>
              <StepFields thread={thread} step="assign" />
              <p className="text-[13.5px] text-fg-2">{thread.contact.name} · {thread.subject}</p>
            </>
          )}
        </PanelAction>
      )}
      {canReassign && (
        <PanelAction<StepResult> label="Asignar" icon={<UserRoundCog size={15} />} size="sm" formId={`asignar-${thread.code}`} title="Asignar conversación" description={thread.assignee ? `Hoy la atiende ${thread.assignee.name}.` : "Aún no tiene responsable."} submitLabel="Asignar" action={conversationStep} initial={initial}>
          {() => (
            <>
              <StepFields thread={thread} step="assign" />
              <SelectField label="Responsable" name="assignee_id" options={agents.map((agent) => ({ value: agent.id, label: agent.name }))} defaultValue={thread.assignee?.id ?? ""} placeholder="Elegir persona" />
            </>
          )}
        </PanelAction>
      )}
      <PanelAction<StepResult> label="Clasificar" icon={<Tags size={15} />} size="sm" formId={`clasificar-${thread.code}`} title="Prioridad y etiquetas" description={thread.subject} submitLabel="Guardar" action={conversationStep} initial={initial}>
        {() => (
          <>
            <StepFields thread={thread} step="classify" />
            <SelectField label="Prioridad" name="priority" options={PRIORITY_OPTIONS} defaultValue={thread.priority} />
            <TextField label="Etiquetas" name="tags" defaultValue={thread.tags.join(", ")} hint="Sepáralas con comas. Máximo 8." />
          </>
        )}
      </PanelAction>
      {resolved ? <QuickStep thread={thread} step="reopen" label="Reabrir" icon={<RotateCcw size={15} />} /> : <QuickStep thread={thread} step="resolve" label="Resolver" icon={<CheckCheck size={15} />} />}
    </div>
  );
}

export function Composer({ thread, templates, me }: { thread: ConversationThread; templates: ReplyTemplate[]; me: string }) {
  const [body, setBody] = useState("");
  const [template, setTemplate] = useState("");
  const [internal, setInternal] = useState(false);
  const [state, run, pending] = useActionState(async (previous: StepResult, form: FormData) => {
    const next = await replyConversation(previous, form);
    if (next.done) {
      setBody("");
      setTemplate("");
    }
    return next;
  }, initial);
  const usable = templates.filter((item) => item.channels.includes(thread.channel));
  const locked = !thread.window_open && !internal && !templates.find((item) => item.code === template)?.whatsapp_approved;

  return (
    <form action={run} className={cn("border-t border-line p-4 transition-colors", internal && "bg-[color-mix(in_srgb,var(--warn)_7%,var(--surface))]")}>
      <input type="hidden" name="code" value={thread.code} />
      <input type="hidden" name="template" value={template} />
      <FormError message={state.done ? null : state.message} />
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <SelectField
          key={`${thread.code}-${state.done ? "sent" : "draft"}`}
          className="min-w-[220px] flex-1"
          label="Plantilla"
          name="template_picker"
          options={usable.map((item) => ({ value: item.code, label: item.name, hint: item.whatsapp_approved ? "Aprobada por Meta" : undefined }))}
          placeholder="Escribir sin plantilla"
          onChange={(value) => {
            setTemplate(value);
            const found = usable.find((item) => item.code === value);
            if (found) setBody(fill(found.body, thread, me));
          }}
        />
        <SwitchField label="Nota interna" hint="Solo la ve el equipo." name="internal" checked={internal} onCheckedChange={setInternal} />
      </div>
      <TextArea label={internal ? "Nota para el equipo" : "Respuesta"} name="body" value={body} onChange={(event) => setBody(event.target.value)} rows={3} maxLength={4000} placeholder={internal ? "Solo la verá el equipo" : `Responder a ${thread.contact.name}`} />
      {locked && (
        <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-warn">
          <Lock size={13} /> Pasaron más de 24 horas desde el último mensaje del cliente: por WhatsApp solo puedes enviar una plantilla aprobada.
        </p>
      )}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {!internal && thread.status !== "resuelta" && (
          <Button type="submit" name="intent" value="resolve" variant="secondary" size="sm" icon={<CheckCheck size={15} />} disabled={pending || body.trim().length < 2}>
            Enviar y resolver
          </Button>
        )}
        <Button type="submit" name="intent" value="send" size="sm" icon={<Send size={15} />} disabled={pending || body.trim().length < 2}>
          {pending ? "Enviando…" : internal ? "Guardar nota" : "Enviar"}
        </Button>
      </div>
    </form>
  );
}
