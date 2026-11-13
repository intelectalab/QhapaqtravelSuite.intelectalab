"use client";

import { Check, Copy, FileText, Gauge, MessageSquareText, Route, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useActionState, useState } from "react";
import { askAssistant, assistantStep, type AssistantState } from "@/app/(backoffice)/asistente/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { formatDateTime, formatNumber } from "@/lib/format";
import { labelOptions, type AiRequest, type AiUsage } from "@/lib/growth";
import type { StepResult } from "@/lib/server/resource";
import { KpiRow, PlanNotice, StatusPill } from "./GrowthUi";

const initial: StepResult = { message: null, done: false };

const STATUS_LABELS: Record<AiRequest["status"], string> = { pending: "Procesando", completed: "Listo para revisar", failed: "Falló", applied: "Aplicado", discarded: "Descartado" };

const KIND_ICONS: Record<string, typeof Route> = { itinerary: Route, quote_draft: FileText, reply_draft: MessageSquareText, summary: Sparkles };

export function AssistantPanel({ usage, sourceType, sourceCode }: { usage: AiUsage; sourceType?: string; sourceCode?: string }) {
  const [kind, setKind] = useState("itinerary");
  return (
    <PanelAction<AssistantState>
      label="Pedir al asistente"
      icon={<Wand2 size={16} />}
      variant="primary"
      formId={`asistente-${sourceCode ?? "libre"}`}
      title="Asistente de ventas"
      description="Describe el pedido del cliente. El asistente deja un borrador: nada se envía ni se confirma sin tu revisión."
      submitLabel="Preparar borrador"
      action={askAssistant}
      initial={{ ...initial, request: null }}
      testId="assistant-ask"
    >
      {() => (
        <>
          <SelectField label="Qué necesitas" name="kind" options={labelOptions(usage.kinds)} value={kind} onChange={setKind} />
          <div className="grid grid-cols-[1fr_1fr] gap-3">
            <SelectField label="Viene de" name="source_type" options={labelOptions(usage.sources)} defaultValue={sourceType ?? "quote"} clearable />
            <TextField label="Código" name="source_code" maxLength={40} defaultValue={sourceCode} placeholder="COT-2026-00191" hint="Opcional." />
          </div>
          <TextArea label="Pedido" name="prompt" rows={6} required minLength={8} maxLength={4000} placeholder="Pareja que quiere 4 días en Cusco en mayo, con Machu Picchu y un día de descanso." hint="No incluyas tarjetas, documentos ni contraseñas: se eliminan antes de enviar." />
          <p className="text-[12.5px] text-fg-3">
            Quedan {formatNumber(usage.remaining)} de {formatNumber(usage.limit)} pedidos este mes.
          </p>
        </>
      )}
    </PanelAction>
  );
}

function RequestActions({ request }: { request: AiRequest }) {
  const [state, run, pending] = useActionState(assistantStep, initial);
  const [copied, setCopied] = useState(false);
  if (request.status !== "completed") return null;
  return (
    <form action={run} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="id" value={request.id} />
      <Button type="submit" name="step" value="apply" size="sm" variant="primary" icon={<Check size={14} />} disabled={pending} title={request.source?.type === "quote" ? "Crea o anota la versión en borrador de la cotización" : "Marca el borrador como usado"}>
        {request.source?.type === "quote" ? "Aplicar a la cotización" : "Usar borrador"}
      </Button>
      {request.text && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          icon={<Copy size={14} />}
          onClick={() => {
            void navigator.clipboard.writeText(request.text ?? "");
            setCopied(true);
          }}
        >
          {copied ? "Copiado" : "Copiar"}
        </Button>
      )}
      <Button type="submit" name="step" value="discard" size="sm" variant="ghost" icon={<Trash2 size={14} />} disabled={pending}>
        Descartar
      </Button>
      {state.message && <p className="basis-full text-[12px] text-bad">{state.message}</p>}
    </form>
  );
}

function RequestCard({ request, index }: { request: AiRequest; index: number }) {
  const Icon = KIND_ICONS[request.kind] ?? Sparkles;
  return (
    <li style={{ animationDelay: `${index * 50}ms` }} className={cn("lift animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] rounded-tile border border-line bg-surface p-4", request.status === "discarded" && "opacity-70")}>
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[color-mix(in_srgb,var(--violet)_14%,transparent)] text-[var(--violet)]">
          <Icon size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">
              {request.kind_label}
              {request.source?.code ? <span className="ml-1.5 font-mono text-[12px] font-normal text-fg-3">{request.source.label} {request.source.code}</span> : null}
            </p>
            <StatusPill status={request.status} label={STATUS_LABELS[request.status]} />
          </div>
          <p className="mt-0.5 line-clamp-2 text-[12.5px] text-fg-3">{request.prompt}</p>
        </div>
      </div>
      {request.text && <p className="mt-3 whitespace-pre-line rounded-xl bg-surface-2 px-3.5 py-3 text-[13px] leading-relaxed">{request.text}</p>}
      {request.error && <p className="mt-3 text-[12.5px] text-bad">{request.error}</p>}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11.5px] text-fg-3">
          {formatDateTime(request.created_at)} · {formatNumber(request.tokens_in + request.tokens_out)} tokens
        </span>
        <RequestActions request={request} />
      </div>
    </li>
  );
}

export function AssistantBoard({ usage }: { usage: AiUsage }) {
  const pct = Math.min(100, usage.pct);
  return (
    <>
      <PlanNotice enabled={usage.enabled} feature="El asistente de ventas con IA" />
      <KpiRow>
        <TintTile icon={Gauge} tone={usage.warning ? "bad" : "t1"} label="Cupo del mes" value={`${formatNumber(usage.used)} / ${formatNumber(usage.limit)}`} note={usage.warning ? "Más del 80 % usado" : `Plan ${usage.plan}`} info={<p>Pedidos de IA de toda la agencia en el mes, incluido el importador de productos. Al llegar al cupo se pausan hasta el mes siguiente.</p>} />
        <TintTile icon={Route} tone="violet" label="Itinerarios" value={usage.by_kind.itinerary ?? 0} info={<p>Itinerarios día por día pedidos este mes.</p>} />
        <TintTile icon={FileText} tone="info" label="Borradores de cotización" value={usage.by_kind.quote_draft ?? 0} info={<p>Propuestas con productos del catálogo pedidas este mes.</p>} />
        <TintTile icon={MessageSquareText} tone="ok" label="Respuestas y resúmenes" value={(usage.by_kind.reply_draft ?? 0) + (usage.by_kind.summary ?? 0)} info={<p>Borradores de respuesta al cliente y resúmenes de conversaciones pedidos este mes.</p>} />
      </KpiRow>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <TintCardTitle icon={Sparkles} title="Tus últimos pedidos" aside={<AssistantPanel usage={usage} />} />
          {usage.recent.length === 0 ? (
            <EmptyState icon={<Wand2 size={22} />} title="Aún no pediste nada al asistente" description="Pídele un itinerario, un borrador de cotización o una respuesta para el cliente." />
          ) : (
            <ul className="grid gap-3">
              {usage.recent.map((request, index) => (
                <RequestCard key={request.id} request={request} index={index} />
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <TintCardTitle icon={Gauge} title="Consumo" />
          <div className="mx-auto grid h-40 w-40 place-items-center rounded-full" style={{ background: `conic-gradient(var(${usage.warning ? "--bad" : "--violet"}) ${pct * 3.6}deg, var(--surface-2) 0deg)` }}>
            <div className="grid h-32 w-32 place-items-center rounded-full bg-surface text-center">
              <div>
                <p className="text-[26px] font-bold tracking-tight">{Math.round(pct)} %</p>
                <p className="text-[11.5px] text-fg-3">de {formatNumber(usage.limit)}</p>
              </div>
            </div>
          </div>
          <dl className="mt-4 grid gap-2 text-[13px]">
            <div className="flex justify-between"><dt className="text-fg-3">Disponibles</dt><dd className="font-semibold">{formatNumber(usage.remaining)}</dd></div>
            <div className="flex justify-between"><dt className="text-fg-3">Tokens del mes</dt><dd className="font-semibold">{formatNumber(usage.tokens_in + usage.tokens_out)}</dd></div>
            <div className="flex justify-between"><dt className="text-fg-3">Costo estimado</dt><dd className="font-semibold">USD {usage.cost_usd}</dd></div>
          </dl>
          <p className="mt-4 text-[12px] text-fg-3">Los datos del cliente se reducen a nombre, fechas, pasajeros y preferencias. Tarjetas, documentos y contraseñas se eliminan antes de enviar el pedido.</p>
        </Card>
      </div>
    </>
  );
}
