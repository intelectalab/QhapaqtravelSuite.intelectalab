"use client";

import { Check, CheckCheck, Hand, Link2, Lock, Paperclip, RotateCcw, Search, Send, Tags, Unlink, UserRoundCog, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { conversationStep, linkConversation, replyConversation, searchConversationLinks } from "@/app/(backoffice)/inbox/actions";
import { FormError } from "@/features/auth/AuthForms";
import { RowIcon } from "@/components/table/RowActions";
import { Button } from "@/components/ui/Button";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { ATTACHMENT_ACCEPT, ATTACHMENT_MAX_BYTES, ATTACHMENT_MAX_FILES, LINK_KINDS, PRIORITY_OPTIONS, type ConversationThread, type LinkKind, type LinkOption, type ReplyTemplate } from "@/lib/inbox";
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

function LinkPicker({ thread, kind }: { thread: ConversationThread; kind: LinkKind }) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<LinkOption[] | null>(null);
  const [picked, setPicked] = useState("");

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      searchConversationLinks(thread.code, kind, query).then((found) => {
        if (alive) setOptions(found);
      });
    }, query ? 300 : 0);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [thread.code, kind, query]);

  return (
    <>
      <input type="hidden" name="target" value={picked} />
      <TextField label="Buscar" name="link_search" value={query} onChange={(event) => setQuery(event.target.value)} icon={<Search size={16} />} placeholder={LINK_KINDS[kind].placeholder} autoComplete="off" />
      {options === null ? (
        <p className="text-[12.5px] text-fg-3">Buscando…</p>
      ) : options.length === 0 ? (
        <p className="text-[12.5px] text-fg-3">{query ? "Sin coincidencias a tu alcance." : "Escribe para buscar."}</p>
      ) : (
        <ul className="flex flex-col gap-1.5" role="listbox" aria-label={`Elegir ${LINK_KINDS[kind].article}`}>
          {options.map((option) => (
            <li key={option.code}>
              <button
                type="button"
                role="option"
                aria-selected={picked === option.code}
                disabled={option.linked}
                onClick={() => setPicked(option.code)}
                className={cn("lift flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60", picked === option.code ? "border-accent bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface))]" : "border-line hover:border-accent/40")}
              >
                <span className="min-w-0">
                  <b className="block truncate text-[13px]">{option.label}</b>
                  <span className="block truncate text-[12px] text-fg-3">{[option.code, option.hint].filter(Boolean).join(" · ")}</span>
                </span>
                {option.linked ? <span className="text-[11.5px] text-fg-3">Vinculado</span> : picked === option.code && <Check size={16} className="flex-none text-accent" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function ConversationLinkAction({ thread, kind, linked }: { thread: ConversationThread; kind: LinkKind; linked: boolean }) {
  const meta = LINK_KINDS[kind];
  return (
    <PanelAction<StepResult>
      label={linked ? "Cambiar" : `Vincular ${meta.label.toLowerCase()}`}
      formId={`vincular-${kind}-${thread.code}`}
      title={linked ? `Cambiar ${meta.label.toLowerCase()}` : `Vincular a ${meta.article}`}
      description={`${thread.contact.name} · ${thread.subject}`}
      submitLabel="Vincular"
      action={linkConversation}
      initial={initial}
      trigger={(open) =>
        linked ? (
          <RowIcon tone="edit" label={`Cambiar ${meta.label.toLowerCase()}`} icon={<Link2 size={15} />} onClick={open} />
        ) : (
          <button type="button" onClick={open} className="lift flex w-full items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2.5 text-[12.5px] font-semibold text-fg-2 hover:border-accent/50 hover:text-accent">
            <Link2 size={15} /> Vincular {meta.label.toLowerCase()}
          </button>
        )
      }
    >
      {() => (
        <>
          <input type="hidden" name="code" value={thread.code} />
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="lock_version" value={thread.lock_version} />
          <LinkPicker thread={thread} kind={kind} />
        </>
      )}
    </PanelAction>
  );
}

export function ConversationUnlinkAction({ thread, kind, code }: { thread: ConversationThread; kind: LinkKind; code: string }) {
  const meta = LINK_KINDS[kind];
  return (
    <PanelAction<StepResult>
      label="Quitar vínculo"
      formId={`desvincular-${kind}-${thread.code}`}
      title="Quitar vínculo"
      description={`La conversación deja de estar vinculada a ${code}. El registro no se modifica.`}
      submitLabel="Quitar"
      action={linkConversation}
      initial={initial}
      trigger={(open) => <RowIcon tone="delete" label={`Quitar ${meta.label.toLowerCase()}`} icon={<Unlink size={15} />} onClick={open} />}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={thread.code} />
          <input type="hidden" name="kind" value={kind} />
          <input type="hidden" name="intent" value="unlink" />
          <input type="hidden" name="lock_version" value={thread.lock_version} />
        </>
      )}
    </PanelAction>
  );
}

export function Composer({ thread, templates, me }: { thread: ConversationThread; templates: ReplyTemplate[]; me: string }) {
  const [body, setBody] = useState("");
  const [template, setTemplate] = useState("");
  const [internal, setInternal] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const picker = useRef<HTMLInputElement>(null);
  const syncFiles = (next: File[]) => {
    setFiles(next);
    if (!picker.current) return;
    const transfer = new DataTransfer();
    next.forEach((file) => transfer.items.add(file));
    picker.current.files = transfer.files;
  };
  const [state, run, pending] = useActionState(async (previous: StepResult, form: FormData) => {
    const next = await replyConversation(previous, form);
    if (next.done) {
      setBody("");
      setTemplate("");
      syncFiles([]);
    }
    return next;
  }, initial);
  const usable = templates.filter((item) => item.channels.includes(thread.channel));
  const locked = !thread.window_open && !internal && !templates.find((item) => item.code === template)?.whatsapp_approved;
  const totalBytes = files.reduce((total, file) => total + file.size, 0);
  const tooMany = files.length > ATTACHMENT_MAX_FILES;
  const tooBig = totalBytes > ATTACHMENT_MAX_BYTES;
  const ready = !pending && !tooMany && !tooBig && (body.trim().length >= 2 || files.length > 0);

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
      {files.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Adjuntos del mensaje">
          {files.map((file, index) => (
            <li key={`${file.name}-${index}`} className="flex animate-[rise-in_320ms_cubic-bezier(0.22,1,0.36,1)_backwards] items-center gap-1.5 rounded-lg border border-line bg-surface-2 py-1 pl-2.5 pr-1 text-[12px]">
              <Paperclip size={12} className="text-fg-3" />
              <span className="max-w-[180px] truncate font-medium">{file.name}</span>
              <span className="text-fg-3">{Math.max(1, Math.round(file.size / 1024))} KB</span>
              <button type="button" onClick={() => syncFiles(files.filter((_, position) => position !== index))} className="grid h-6 w-6 place-items-center rounded-md text-fg-3 transition hover:bg-surface hover:text-bad" aria-label={`Quitar ${file.name}`}>
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {(tooMany || tooBig) && <p className="mt-2 text-[12.5px] text-bad">{tooMany ? `Puedes adjuntar hasta ${ATTACHMENT_MAX_FILES} archivos por mensaje.` : "Los adjuntos de un mensaje pueden sumar hasta 10 MB."}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <label className="mr-auto inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-semibold text-fg-2 transition hover:bg-surface-2 hover:text-accent focus-within:ring-2 focus-within:ring-accent/40" title="Imágenes JPG, PNG o WebP y PDF; el antivirus revisa cada archivo antes de enviarlo">
          <Paperclip size={15} /> Adjuntar
          <input
            ref={picker}
            type="file"
            name="files"
            multiple
            accept={ATTACHMENT_ACCEPT}
            className="sr-only"
            onChange={(event) => syncFiles([...files, ...Array.from(event.target.files ?? [])])}
          />
        </label>
        {!internal && thread.status !== "resuelta" && (
          <Button type="submit" name="intent" value="resolve" variant="secondary" size="sm" icon={<CheckCheck size={15} />} disabled={!ready}>
            Enviar y resolver
          </Button>
        )}
        <Button type="submit" name="intent" value="send" size="sm" icon={<Send size={15} />} disabled={!ready}>
          {pending ? "Enviando…" : internal ? "Guardar nota" : "Enviar"}
        </Button>
      </div>
    </form>
  );
}
