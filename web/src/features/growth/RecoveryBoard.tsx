"use client";

import { CalendarClock, Coins, Mail, MessageCircle, Pause, Play, Plus, Repeat2, Send, ShoppingCart, FileText, Undo2 } from "lucide-react";
import { useActionState, useState } from "react";
import { saveRecoveryFlow, toggleRecoveryFlow } from "@/app/(backoffice)/marketing/recuperacion/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowIcon } from "@/components/table/RowActions";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { EmptyState } from "@/components/ui/EmptyState";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { Tabs } from "@/components/ui/Tabs";
import { TextField } from "@/components/ui/TextField";
import { TintTile } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { formatDateTime, formatMoney } from "@/lib/format";
import { delayLabel, labelOptions, type RecoveryAttempt, type RecoveryFlow, type RecoveryOverview } from "@/lib/growth";
import type { StepResult } from "@/lib/server/resource";
import { toneStyle } from "@/lib/tone";
import { KpiRow, PlanNotice, StatusPill } from "./GrowthUi";

const initial: StepResult = { message: null, done: false };

function splitDelay(minutes: number): { value: number; unit: string } {
  if (minutes % 1440 === 0) return { value: minutes / 1440, unit: "1440" };
  if (minutes % 60 === 0) return { value: minutes / 60, unit: "60" };
  return { value: minutes, unit: "1" };
}

function FlowForm({ overview, flow }: { overview: RecoveryOverview; flow?: RecoveryFlow }) {
  const [channel, setChannel] = useState<string>(flow?.channel ?? "email");
  const [link, setLink] = useState(flow?.include_payment_link ?? true);
  const [active, setActive] = useState(flow?.active ?? false);
  const delay = splitDelay(flow?.delay_minutes ?? 120);
  const templates = channel === "email" ? overview.options.email : overview.options.whatsapp.map((option) => ({ ...option, hint: option.approved ? undefined : "Sin aprobación de Meta" }));
  return (
    <PanelAction<StepResult>
      label="Nuevo flujo"
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      formId={flow ? `flujo-${flow.code}` : "flujo-nuevo"}
      title={flow ? `Editar ${flow.name}` : "Nuevo flujo de recuperación"}
      description="Escribe al cliente cuando deja un carrito o una cotización sin avanzar. Solo a quien autorizó el canal."
      submitLabel={flow ? "Guardar cambios" : "Crear flujo"}
      action={saveRecoveryFlow}
      initial={initial}
      testId={flow ? undefined : "recovery-create"}
      trigger={flow ? (open) => <RowIcon tone="edit" label="Editar flujo" onClick={open} /> : undefined}
    >
      {() => (
        <>
          {flow && <input type="hidden" name="code" value={flow.code} />}
          <input type="hidden" name="include_payment_link" value={link ? "1" : "0"} />
          <input type="hidden" name="active" value={active ? "1" : "0"} />
          <TextField label="Nombre" name="name" required minLength={3} maxLength={120} defaultValue={flow?.name} icon={<Repeat2 size={17} />} />
          <ChoiceGroup label="Qué recupera" name="trigger_kind" options={labelOptions(overview.catalogs.triggers)} defaultValue={flow?.trigger_kind ?? "cart"} />
          <div className="grid grid-cols-[1fr_1fr] gap-3">
            <TextField label="Espera" name="delay_value" type="number" min={1} max={20160} required defaultValue={delay.value} icon={<CalendarClock size={17} />} />
            <SelectField label="Unidad" name="delay_unit" options={[{ value: "1", label: "Minutos" }, { value: "60", label: "Horas" }, { value: "1440", label: "Días" }]} defaultValue={delay.unit} />
          </div>
          <ChoiceGroup label="Canal" name="channel" options={labelOptions(overview.catalogs.channels)} defaultValue={channel} onChange={setChannel} />
          <SelectField key={channel} label="Plantilla" name="template_ref" options={templates} defaultValue={flow?.channel === channel ? flow.template_ref : ""} placeholder="Elegir plantilla" hint={channel === "whatsapp" ? "Un flujo activo por WhatsApp necesita una plantilla aprobada por Meta." : "Plantillas de correo de Marketing."} />
          <SelectField label="Intentos como máximo" name="max_attempts" options={[1, 2, 3, 4, 5].map((value) => ({ value: String(value), label: `${value} ${value === 1 ? "intento" : "intentos"}` }))} defaultValue={String(flow?.max_attempts ?? 2)} />
          <SwitchField label="Incluir link de pago" name="link_switch" checked={link} onCheckedChange={setLink} hint="El mensaje lleva el enlace para pagar sin volver a empezar." />
          <SwitchField label="Flujo activo" name="active_switch" checked={active} onCheckedChange={setActive} hint="Se descarta el intento si el cliente ya compró o se dio de baja." />
        </>
      )}
    </PanelAction>
  );
}

function ToggleFlow({ flow }: { flow: RecoveryFlow }) {
  const [state, run, pending] = useActionState(toggleRecoveryFlow, initial);
  return (
    <form action={run} className="contents">
      <input type="hidden" name="code" value={flow.code} />
      <input type="hidden" name="active" value={flow.active ? "0" : "1"} />
      <Button type="submit" size="sm" variant="secondary" icon={flow.active ? <Pause size={14} /> : <Play size={14} />} disabled={pending} title={state.message ?? undefined}>
        {pending ? "Un momento…" : flow.active ? "Pausar" : "Activar"}
      </Button>
      {state.message && <p className="basis-full text-[12px] text-bad">{state.message}</p>}
    </form>
  );
}

function FlowCard({ flow, overview, index }: { flow: RecoveryFlow; overview: RecoveryOverview; index: number }) {
  const Icon = flow.trigger_kind === "cart" ? ShoppingCart : FileText;
  const rate = flow.stats.rate ?? 0;
  return (
    <li style={{ ...toneStyle(flow.trigger_kind === "cart" ? "sun" : "info"), animationDelay: `${index * 60}ms` }} className={cn("lift flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-col gap-3 rounded-tile border border-line bg-surface p-4", !flow.active && "bg-surface-2/40")}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[color-mix(in_srgb,var(--tint)_14%,transparent)] text-[var(--tint)]">
          <Icon size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold leading-snug">{flow.name}</p>
            <StatusPill status={flow.active ? "activo" : "pausado"} label={flow.active ? "Activo" : "Pausado"} />
          </div>
          <p className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-fg-3">
            {flow.channel === "email" ? <Mail size={13} /> : <MessageCircle size={13} />}
            {flow.channel_label} · a las {delayLabel(flow.delay_minutes)} · hasta {flow.max_attempts} {flow.max_attempts === 1 ? "intento" : "intentos"}
          </p>
          <p className="mt-0.5 truncate font-mono text-[11.5px] text-fg-3">{flow.template_ref}</p>
        </div>
      </div>
      <div title={`${flow.stats.recovered} recuperados de ${flow.stats.sent} enviados`}>
        <div className="flex items-baseline justify-between text-[12px]">
          <span className="text-fg-3">Recuperación</span>
          <span>
            <b className="text-[15px]">{flow.stats.rate === null ? "Sin envíos" : `${rate} %`}</b> <span className="text-fg-3">· {flow.stats.recovered} de {flow.stats.sent}</span>
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
          <span style={{ width: `${Math.min(100, rate)}%` }} className="block h-full origin-left bg-ok motion-safe:animate-[fill-x_620ms_cubic-bezier(0.4,0,0.2,1)_backwards]" />
        </div>
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <span className="text-[12.5px] text-fg-3">{flow.stats.recovered_amount && Number(flow.stats.recovered_amount) > 0 ? `${formatMoney(flow.stats.recovered_amount)} recuperados` : `${flow.stats.scheduled} programados`}</span>
        <div className="flex items-center gap-2">
          <ToggleFlow flow={flow} />
          <FlowForm overview={overview} flow={flow} />
        </div>
      </div>
    </li>
  );
}

function AttemptsTable({ attempts, overview }: { attempts: RecoveryAttempt[]; overview: RecoveryOverview }) {
  return (
    <DataTable
      screen="marketing-recuperacion-intentos"
      rows={attempts}
      getKey={(attempt) => attempt.id}
      entityLabel="intentos"
      searchText={(attempt) => `${attempt.client ?? ""} ${attempt.origin.code ?? ""} ${attempt.flow.name}`}
      searchPlaceholder="Buscar por cliente, carrito o cotización"
      metrics={[
        { id: "programado", label: "Programados", tone: "info", icon: <CalendarClock size={18} />, matches: (attempt) => attempt.status === "programado" },
        { id: "enviado", label: "Enviados", tone: "t1", icon: <Send size={18} />, matches: (attempt) => attempt.status === "enviado" },
        { id: "recuperado", label: "Recuperados", tone: "ok", icon: <Undo2 size={18} />, matches: (attempt) => attempt.status === "recuperado" },
      ]}
      filters={[
        { id: "status", label: "Estado", options: labelOptions(overview.catalogs.statuses), value: (attempt) => attempt.status },
        { id: "flow", label: "Flujo", options: overview.flows.map((flow) => ({ value: flow.code, label: flow.name })), value: (attempt) => attempt.flow.code },
      ]}
      sorts={[{ id: "scheduled", label: "Programado", type: "date", value: (attempt) => attempt.scheduled_at }]}
      emptyTitle="Aún no hay intentos"
      columns={[
        { id: "client", header: "Cliente", mobile: "title", cell: (attempt) => <div><p className="font-semibold">{attempt.client ?? "Sin cliente"}</p><p className="font-mono text-[11.5px] text-fg-3">{attempt.to}</p></div> },
        { id: "origin", header: "Origen", cell: (attempt) => <span className="text-[13px]">{attempt.origin.label} <span className="font-mono text-fg-2">{attempt.origin.code}</span></span> },
        { id: "flow", header: "Flujo", wideOnly: true, cell: (attempt) => <span className="text-[13px] text-fg-2">{attempt.flow.name} · intento {attempt.attempt_no}</span> },
        { id: "scheduled", header: "Programado", cell: (attempt) => <span className="text-[12.5px] text-fg-2">{formatDateTime(attempt.scheduled_at)}</span> },
        { id: "status", header: "Estado", cell: (attempt) => <StatusPill status={attempt.status} label={attempt.status_label} /> },
        { id: "result", header: "Resultado", align: "right", cell: (attempt) => (attempt.reservation ? <span className="text-[13px]"><span className="font-mono">{attempt.reservation}</span>{attempt.recovered_amount ? ` · ${formatMoney(attempt.recovered_amount)}` : ""}</span> : <span className="text-fg-3">—</span>) },
      ]}
    />
  );
}

export function RecoveryBoard({ overview, attempts }: { overview: RecoveryOverview; attempts: RecoveryAttempt[] }) {
  const { kpis } = overview;
  return (
    <>
      <PlanNotice enabled={overview.enabled} feature="La recuperación de carritos y cotizaciones" />
      <KpiRow>
        <TintTile icon={Repeat2} tone="t1" label="Flujos activos" value={kpis.active} note={`de ${overview.flows.length} flujos`} info={<p>Flujos de recuperación encendidos. Cada uno vigila carritos o cotizaciones sin avance y programa el mensaje.</p>} />
        <TintTile icon={CalendarClock} tone="info" label="Programados" value={kpis.scheduled} info={<p>Intentos que esperan su hora de envío. Se descartan si el cliente compra antes o se da de baja.</p>} />
        <TintTile icon={Send} tone="violet" label="Enviados" value={kpis.sent} info={<p>Intentos enviados por correo o WhatsApp, incluidos los que ya terminaron en una venta.</p>} />
        <TintTile icon={Coins} tone="ok" label="Recuperados" value={kpis.recovered} note={kpis.recovered_amount && Number(kpis.recovered_amount) > 0 ? formatMoney(kpis.recovered_amount) : "Sin ventas recuperadas"} info={<p>Intentos que terminaron en una reserva creada desde el carrito o la cotización, con el monto de esa reserva.</p>} />
      </KpiRow>
      <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <Tabs
          tabs={[
            {
              id: "flujos",
              label: "Flujos",
              count: overview.flows.length,
              content: (
                <>
                  <div className="mb-4 flex justify-end">
                    <FlowForm overview={overview} />
                  </div>
                  {overview.flows.length === 0 ? (
                    <EmptyState icon={<Repeat2 size={22} />} title="Aún no hay flujos" description="Crea el primero para escribir a quien dejó un carrito o una cotización sin avanzar." />
                  ) : (
                    <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                      {overview.flows.map((flow, index) => (
                        <FlowCard key={flow.code} flow={flow} overview={overview} index={index} />
                      ))}
                    </ul>
                  )}
                </>
              ),
            },
            { id: "intentos", label: "Intentos", count: attempts.length, content: <AttemptsTable attempts={attempts} overview={overview} /> },
          ]}
        />
      </section>
    </>
  );
}
