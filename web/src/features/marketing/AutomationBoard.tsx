"use client";

import { Cake, Clock3, Mail, MessageCircle, Pause, Play, PlaneTakeoff, RefreshCw, RotateCcw, Settings2, ShoppingCart, Star, UserPlus, type LucideIcon } from "lucide-react";
import { useActionState } from "react";
import { automationStep } from "@/app/(backoffice)/marketing/campanas/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { Timeline } from "@/features/channels/ChannelUi";
import { cn } from "@/lib/cn";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { Automation, AutomationsOverview } from "@/lib/marketing";
import type { StepResult } from "@/lib/server/resource";
import { toneStyle, type Tone } from "@/lib/tone";

const initial: StepResult = { message: null, done: false };

const KEY_ICONS: Record<Automation["key"], LucideIcon> = { welcome: UserPlus, cart: ShoppingCart, pretrip: PlaneTakeoff, survey: Star, birthday: Cake, reactivation: RotateCcw };

const KEY_TONES: Record<Automation["key"], Tone> = { welcome: "t1", cart: "sun", pretrip: "info", survey: "violet", birthday: "t4", reactivation: "accent" };

function Hidden({ automation, step }: { automation: Automation; step: string }) {
  return (
    <>
      <input type="hidden" name="code" value={automation.code} />
      <input type="hidden" name="lock_version" value={automation.lock_version} />
      <input type="hidden" name="step" value={step} />
    </>
  );
}

function ToggleStep({ automation }: { automation: Automation }) {
  const [state, run, pending] = useActionState(automationStep, initial);
  const active = automation.status === "activa";
  return (
    <form action={run} className="contents">
      <Hidden automation={automation} step={active ? "pause" : "activate"} />
      <Button type="submit" size="sm" variant="secondary" icon={active ? <Pause size={14} /> : <Play size={14} />} disabled={pending} title={state.message ?? undefined}>
        {pending ? "Un momento…" : active ? "Pausar" : "Activar"}
      </Button>
      {state.message && <p className="basis-full text-[12px] text-bad">{state.message}</p>}
    </form>
  );
}

function QueueBar({ automation }: { automation: Automation }) {
  const { total, sendable, suppressed } = automation.queue;
  const share = total > 0 ? (sendable / total) * 100 : 0;
  return (
    <div title={`${sendable} enviables · ${suppressed} suprimidos por consentimiento, baja o dato`}>
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="text-fg-3">En cola ahora</span>
        <span>
          <b className="text-[15px]">{total}</b> <span className="text-fg-3">· {sendable} enviables{suppressed > 0 ? ` · ${suppressed} suprimidos` : ""}</span>
        </span>
      </div>
      <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-surface-2">
        {total > 0 && <span style={{ width: `${share}%` }} className="h-full bg-ok motion-safe:animate-[fill-x_620ms_cubic-bezier(0.4,0,0.2,1)_backwards] origin-left" />}
        {suppressed > 0 && <span style={{ width: `${100 - share}%` }} className="h-full bg-[color-mix(in_srgb,var(--bad)_55%,transparent)]" />}
      </div>
    </div>
  );
}

function RunAction({ automation }: { automation: Automation }) {
  const active = automation.status === "activa";
  return (
    <PanelAction<StepResult>
      label="Ejecutar ahora"
      formId={`ejecutar-${automation.code}`}
      title={`Ejecutar: ${automation.name}`}
      description="Procesa la cola de inmediato. Cada disparo se procesa una sola vez."
      submitLabel={`Enviar a ${automation.queue.sendable}`}
      action={automationStep}
      initial={initial}
      trigger={(open) => (
        <Button size="sm" variant="secondary" icon={<RefreshCw size={14} />} onClick={open} disabled={!active || automation.queue.total === 0} title={!active ? "Activa la automatización para ejecutarla" : automation.queue.total === 0 ? "No hay contactos en cola" : undefined}>
          Ejecutar ahora
        </Button>
      )}
    >
      {() => (
        <>
          <Hidden automation={automation} step="run" />
          <div className="grid grid-cols-2 gap-2">
            <div style={toneStyle("ok")} className="rounded-xl bg-[color-mix(in_srgb,var(--tint)_10%,var(--surface))] px-3 py-2.5">
              <p className="text-[11.5px] text-fg-3">Se envían</p>
              <p className="text-[18px] font-bold text-[var(--tint)]">{automation.queue.sendable}</p>
            </div>
            <div style={toneStyle("bad")} className="rounded-xl bg-[color-mix(in_srgb,var(--tint)_8%,var(--surface))] px-3 py-2.5">
              <p className="text-[11.5px] text-fg-3">Se suprimen</p>
              <p className="text-[18px] font-bold text-[var(--tint)]">{automation.queue.suppressed}</p>
            </div>
          </div>
          <p className="text-[13px] text-fg-2">
            {automation.purpose === "comercial" ? "Es comercial: solo recibe quien autorizó el canal y no se dio de baja." : "Es de servicio: se basa en el contrato de viaje y aun así respeta las bajas registradas."}
          </p>
          <p className="text-[12.5px] text-fg-3">Plantilla {automation.template?.name ?? "sin asignar"} · {automation.channel_label}</p>
        </>
      )}
    </PanelAction>
  );
}

function ConfigureAction({ automation, templates }: { automation: Automation; templates: AutomationsOverview["templates"] }) {
  const options = templates.filter((template) => template.channel === automation.channel).map((template) => ({ value: template.code, label: template.name, hint: template.usable ? undefined : "Sin aprobación de Meta" }));
  return (
    <PanelAction<StepResult>
      label="Configurar"
      formId={`configurar-${automation.code}`}
      title={`Configurar: ${automation.name}`}
      description={automation.trigger}
      submitLabel="Guardar cambios"
      action={automationStep}
      initial={initial}
      trigger={(open) => (
        <Button size="sm" variant="ghost" icon={<Settings2 size={14} />} onClick={open}>
          Configurar
        </Button>
      )}
    >
      {() => (
        <>
          <Hidden automation={automation} step="configure" />
          <SelectField label="Plantilla" name="template" options={options} defaultValue={automation.template?.code ?? ""} placeholder="Elegir plantilla" hint={automation.channel === "whatsapp" ? "Una automatización activa solo usa plantillas aprobadas por Meta." : undefined} />
          <TextField label="Espera o programación" name="delay" required minLength={3} maxLength={80} defaultValue={automation.delay} icon={<Clock3 size={17} />} />
          <div>
            <p className="mb-2 text-[13px] font-semibold">Historial</p>
            <Timeline items={automation.history.map((entry, index) => ({ key: `${entry.at}-${index}`, title: entry.label, meta: `${formatDateTime(entry.at)}${entry.by ? ` · ${entry.by}` : ""}`, note: entry.detail ?? undefined }))} />
          </div>
        </>
      )}
    </PanelAction>
  );
}

function AutomationCard({ automation, templates, canManage, index }: { automation: Automation; templates: AutomationsOverview["templates"]; canManage: boolean; index: number }) {
  const Icon = KEY_ICONS[automation.key];
  const active = automation.status === "activa";
  return (
    <li style={{ ...toneStyle(KEY_TONES[automation.key]), animationDelay: `${index * 60}ms` }} className={cn("lift flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-col rounded-tile border border-line bg-surface p-4", !active && "bg-surface-2/40")}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[color-mix(in_srgb,var(--tint)_14%,transparent)] text-[var(--tint)]">
          <Icon size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <b className="text-[14.5px] leading-snug">{automation.name}</b>
            <Badge tone={active ? "ok" : "mute"}>{active ? "Activa" : "Pausada"}</Badge>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-fg-3">
            {automation.channel === "email" ? <Mail size={13} /> : <MessageCircle size={13} />}
            {automation.channel_label} · {automation.purpose_label}
          </p>
        </div>
      </div>
      <p className="mt-3 text-[13px] text-fg-2">{automation.trigger}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-[12.5px]">
        <div className="rounded-lg bg-surface-2 px-2.5 py-2">
          <dt className="text-[11px] text-fg-3">Espera</dt>
          <dd className="font-medium">{automation.delay}</dd>
        </div>
        <div className="rounded-lg bg-surface-2 px-2.5 py-2">
          <dt className="text-[11px] text-fg-3">Plantilla</dt>
          <dd className="truncate font-medium" title={automation.template?.name}>{automation.template?.name ?? "Sin asignar"}</dd>
          {automation.template && !automation.template.usable && <dd className="text-[11px] font-semibold text-warn">Sin aprobación de Meta</dd>}
        </div>
      </dl>
      <div className="mt-3">
        <QueueBar automation={automation} />
      </div>
      {automation.queue.items.length > 0 && (
        <ul className="mt-2.5 divide-y divide-line-2 rounded-lg border border-line-2">
          {automation.queue.items.map((item, position) => (
            <li key={`${item.name}-${position}`} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-medium">{item.name}</span>
                <span className="block truncate text-[11px] text-fg-3">{item.why}</span>
              </span>
              <Badge tone={item.block ? "bad" : "info"} dot={false}>{item.block ?? "En cola"}</Badge>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-[12px] text-fg-3">
        Acumulado: <b className="text-fg-2">{formatNumber(automation.totals.sent)}</b> enviados · {automation.totals.conversions} conversiones
        {automation.last_run && (
          <span className="block">
            Última ejecución {formatDateTime(automation.last_run.at, false)} · {automation.last_run.sent} env. / {automation.last_run.suppressed} sup.
          </span>
        )}
      </p>
      {canManage && (
        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line-2 pt-3">
          <ToggleStep automation={automation} />
          <RunAction automation={automation} />
          <ConfigureAction automation={automation} templates={templates} />
        </div>
      )}
    </li>
  );
}

export function AutomationBoard({ overview }: { overview: AutomationsOverview }) {
  if (overview.automations.length === 0) return <EmptyState icon={<RefreshCw size={20} />} title="Sin automatizaciones" description="Las automatizaciones de bienvenida, carrito, pre-viaje, encuesta, cumpleaños y reactivación aparecen aquí cuando se habilitan para tu agencia." />;
  return (
    <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
      {overview.automations.map((automation, index) => (
        <AutomationCard key={automation.code} automation={automation} templates={overview.templates} canManage={overview.can.manage} index={index} />
      ))}
    </ul>
  );
}
