"use client";

import { CalendarDays, MapPin, MessageCircle, MessageSquareText, MessagesSquare, Package, Sparkles, StickyNote, Target, UserRound, Users, Wand2 } from "lucide-react";
import { startTransition, useActionState, useEffect, useState, type FormEvent } from "react";
import { askAssistant, type AssistantState } from "@/app/(backoffice)/asistente/actions";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { SidePanel } from "@/components/ui/SidePanel";
import { TextArea } from "@/components/ui/TextArea";
import { toast } from "@/components/ui/Toast";
import { FormError } from "@/features/auth/AuthForms";
import { ASSISTANT_KIND_HINTS, orderedKinds, quotaLine, sendToComposer, suggestedPrompt, type AssistantContext, type AssistantFact, type AssistantSourceType } from "@/lib/assistant";
import { cn } from "@/lib/cn";
import { KIND_ICONS, RequestCard } from "./AssistantBoard";
import { PlanNotice } from "./GrowthUi";

const FACT_ICONS: Record<string, typeof Sparkles> = { client: UserRound, pax: Users, dates: CalendarDays, destinations: MapPin, products: Package, interest: Target, notes: StickyNote, channel: MessagesSquare, messages: MessageSquareText, last: MessageCircle };

const initial: AssistantState = { message: null, done: false, request: null };

interface AssistantSidePanelProps {
  source: { type: AssistantSourceType; code: string };
  context: AssistantContext | null;
  available: boolean;
  unavailableMessage?: string | null;
  returnPath: string;
  label?: string;
}

function FactTile({ fact, index }: { fact: AssistantFact; index: number }) {
  const Icon = FACT_ICONS[fact.key] ?? Sparkles;
  const wide = fact.key === "last" || fact.key === "notes" || (fact.items?.length ?? 0) > 0;
  return (
    <li style={{ animationDelay: `${index * 40}ms` }} title={fact.items?.join(" · ")} className={cn("group flex min-w-0 animate-[rise-in_380ms_cubic-bezier(0.22,1,0.36,1)_backwards] items-start gap-2.5 rounded-xl border border-line bg-surface px-3 py-2.5 transition hover:-translate-y-px hover:border-[color-mix(in_srgb,var(--violet)_40%,var(--line))] hover:shadow-[0_8px_18px_-14px_var(--violet)]", wide && "col-span-2")}>
      <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-[color-mix(in_srgb,var(--violet)_12%,transparent)] text-[var(--violet)] transition group-hover:bg-[var(--violet)] group-hover:text-white">
        <Icon size={14} />
      </span>
      <span className="min-w-0">
        <span className="block text-[11.5px] text-fg-3">{fact.label}</span>
        <span className={cn("block text-[13px] font-semibold", wide ? "line-clamp-2" : "truncate")}>{fact.value}</span>
        {fact.items && fact.items.length > 0 && <span className="mt-0.5 block truncate text-[12px] text-fg-3">{fact.items.join(" · ")}</span>}
      </span>
    </li>
  );
}

function KindPicker({ options, value, onChange }: { options: { value: string; label: string }[]; value: string; onChange: (value: string) => void }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-[13px] font-semibold text-fg">Qué necesitas</legend>
      <div role="radiogroup" aria-label="Qué necesitas" data-testid="field:kind" data-value={value} className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const Icon = KIND_ICONS[option.value] ?? Sparkles;
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              data-testid={`option:${option.value}`}
              onClick={() => onChange(option.value)}
              className={cn("group flex items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition hover:-translate-y-px", active ? "border-[var(--violet)] bg-[color-mix(in_srgb,var(--violet)_9%,var(--surface))] shadow-[0_8px_18px_-14px_var(--violet)]" : "border-line bg-surface hover:border-[color-mix(in_srgb,var(--violet)_35%,var(--line))]")}
            >
              <Icon size={16} className={cn("mt-0.5 flex-none transition", active ? "text-[var(--violet)]" : "text-fg-3 group-hover:text-[var(--violet)]")} />
              <span className="min-w-0">
                <span className="block text-[13px] font-semibold leading-tight">{option.label}</span>
                <span className="mt-0.5 block text-[11.5px] text-fg-3">{ASSISTANT_KIND_HINTS[option.value]}</span>
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function AssistantForm({ source, context, returnPath, formId, onReply, onPending }: { source: AssistantSidePanelProps["source"]; context: AssistantContext; returnPath: string; formId: string; onReply?: (text: string) => void; onPending: (pending: boolean) => void }) {
  const kinds = orderedKinds(source.type, context.kinds);
  const [kind, setKind] = useState(kinds[0]?.value ?? "itinerary");
  const [prompt, setPrompt] = useState(() => suggestedPrompt(source.type, kinds[0]?.value ?? "itinerary", context.facts));
  const [edited, setEdited] = useState(false);
  const [state, run, pending] = useActionState(async (previous: AssistantState, form: FormData) => {
    const next = await askAssistant(previous, form);
    if (next.done) {
      setEdited(false);
      setPrompt(suggestedPrompt(source.type, kind, context.facts));
      toast("El borrador está listo para revisar.", "ok");
    }
    return next;
  }, initial);
  useEffect(() => onPending(pending), [onPending, pending]);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    startTransition(() => run(form));
  };
  const latest = state.request && !context.recent.some((item) => item.id === state.request?.id) ? [state.request, ...context.recent] : context.recent;

  return (
    <div className="flex flex-col gap-5">
      <PlanNotice enabled={context.usage.enabled} feature="El asistente de ventas con IA" />
      <form id={formId} onSubmit={submit} className="flex flex-col gap-4">
        <FormError message={state.done ? null : state.message} />
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="source_type" value={source.type} />
        <input type="hidden" name="source_code" value={source.code} />
        <input type="hidden" name="return_path" value={returnPath} />
        <KindPicker
          options={kinds}
          value={kind}
          onChange={(next) => {
            setKind(next);
            if (!edited) setPrompt(suggestedPrompt(source.type, next, context.facts));
          }}
        />
        <TextArea
          label="Pedido"
          name="prompt"
          rows={4}
          required
          minLength={8}
          maxLength={4000}
          value={prompt}
          onChange={(event) => {
            setPrompt(event.target.value);
            setEdited(true);
          }}
          hint="El asistente ya ve los datos de arriba. No incluyas tarjetas, documentos ni contraseñas: se eliminan antes de enviar."
        />
        <p className={cn("text-[12.5px]", context.usage.warning ? "text-bad" : "text-fg-3")}>{quotaLine(context.usage)}</p>
      </form>
      <section aria-label="Borradores de este registro">
        <p className="mb-2 text-[13px] font-semibold">En este registro</p>
        {latest.length === 0 ? (
          <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[12.5px] text-fg-3">Todavía no pediste nada al asistente desde aquí. Nada se envía ni se confirma sin tu revisión.</p>
        ) : (
          <ul className="grid gap-3">
            {latest.map((request, index) => (
              <RequestCard key={request.id} request={request} index={index} returnPath={returnPath} onReply={onReply} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export function AssistantSidePanel({ source, context, available, unavailableMessage, returnPath, label = "Asistente" }: AssistantSidePanelProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const formId = `asistente-lateral-${source.type}-${source.code}`;
  const ready = available && context !== null;
  const onReply =
    source.type === "conversation"
      ? (text: string) => {
          sendToComposer(source.code, text);
          setOpen(false);
          toast("Pegamos el borrador en la respuesta. Revísalo antes de enviarlo.", "ok");
        }
      : undefined;

  return (
    <>
      <Button variant="secondary" icon={<Wand2 size={16} />} iconOnlyOnMobile onClick={() => setOpen(true)} data-testid="assistant-side-open" title="Pide al asistente un borrador con los datos de este registro">
        {label}
      </Button>
      <SidePanel
        open={open}
        onOpenChange={setOpen}
        title="Asistente de ventas"
        description={context ? `${context.source.label} ${context.source.code} · ${context.source.title}` : "Borradores con los datos de este registro."}
        subheader={
          ready && context.facts.length > 0 ? (
            <div>
              <p className="mb-2 text-[12px] font-semibold text-fg-3">Lo que ve el asistente</p>
              <ul className="grid grid-cols-2 gap-2" data-testid="assistant-context">
                {context.facts.map((fact, index) => (
                  <FactTile key={fact.key} fact={fact} index={index} />
                ))}
              </ul>
            </div>
          ) : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} data-testid="dialog-cancel">
              Cerrar
            </Button>
            {ready && (
              <Button type="submit" form={formId} variant="primary" icon={<Sparkles size={15} />} disabled={busy || !context.usage.enabled || context.usage.exhausted} data-testid="assistant-side-ask">
                {busy ? "Preparando…" : "Preparar borrador"}
              </Button>
            )}
          </>
        }
      >
        {!available ? (
          <div data-testid="coming-soon">
            <EmptyState icon={<Sparkles size={20} />} title="Próximamente" description={unavailableMessage ?? "El asistente de ventas con IA estará disponible próximamente."} />
          </div>
        ) : context === null ? (
          <EmptyState icon={<Sparkles size={20} />} title="No pudimos cargar el contexto" description="Vuelve a intentarlo en unos segundos." />
        ) : (
          <AssistantForm source={source} context={context} returnPath={returnPath} formId={formId} onReply={onReply} onPending={setBusy} />
        )}
      </SidePanel>
    </>
  );
}
