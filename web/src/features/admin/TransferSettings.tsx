"use client";

import { BellRing, Clock3, FileCheck2, Landmark, ShieldAlert, TimerOff, UsersRound } from "lucide-react";
import { useState, type ReactNode } from "react";
import { updateTransferValidation } from "@/app/(backoffice)/admin/configuracion/pagos-actions";
import { Badge } from "@/components/ui/Badge";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { InfoTip } from "@/components/ui/InfoTip";
import { SwitchField } from "@/components/ui/SwitchField";
import type { TransferValidationSettings } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { toneStyle, type Tone } from "@/lib/tone";
import { EditSection, SectionCard } from "./Settings";

export const minutesLabel = (minutes: number) => (minutes % 60 === 0 ? `${minutes / 60} h` : `${minutes} min`);

const options = (values: number[], label: (value: number) => string) => values.map((value) => ({ value: String(value), label: label(value) }));

function StateTile({ icon: Icon, tone, title, on, detail, children }: { icon: typeof Landmark; tone: Tone; title: string; on: boolean; detail: string; children?: ReactNode }) {
  return (
    <div style={toneStyle(on ? tone : "mute")} className="lift group rounded-tile border border-[color-mix(in_srgb,var(--tint)_22%,transparent)] bg-[color-mix(in_srgb,var(--tint)_6%,var(--surface))] p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--tint)] text-white shadow-[0_8px_18px_-10px_var(--tint)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
          <Icon size={18} />
        </span>
        <Badge tone={on ? "ok" : "mute"}>{on ? "Encendido" : "Apagado"}</Badge>
      </div>
      <b className="mt-3 block text-[14px] font-semibold text-fg">{title}</b>
      <p className="mt-0.5 text-[12.5px] text-fg-2">{detail}</p>
      {children}
    </div>
  );
}

function Step({ icon: Icon, tone, when, title, detail, index }: { icon: typeof BellRing; tone: Tone; when: string; title: string; detail: string; index: number }) {
  return (
    <li style={{ ...toneStyle(tone), animationDelay: `${index * 80}ms` }} className="lift group relative animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] rounded-tile border border-line bg-surface p-3.5">
      <span className="flex items-center gap-2.5">
        <span className="grid h-8 w-8 flex-none place-items-center rounded-lg bg-[color-mix(in_srgb,var(--tint)_14%,transparent)] text-[var(--tint)] transition-transform duration-300 group-hover:scale-110">
          <Icon size={16} />
        </span>
        <span className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[11.5px] font-semibold text-fg-2">{when}</span>
      </span>
      <b className="mt-2 block text-[13px] font-semibold text-fg">{title}</b>
      <span className="text-[12px] text-fg-3">{detail}</span>
    </li>
  );
}

function Editor({ settings }: { settings: TransferValidationSettings }) {
  const [alert, setAlert] = useState(settings.alert_finance);
  const [cancel, setCancel] = useState(settings.auto_cancel);
  return (
    <div className="grid gap-5">
      <section className="grid gap-3 rounded-tile border border-line p-4">
        <SwitchField label="Avisar a Finanzas si un pago sigue sin validar" name="alert_finance" checked={alert} onCheckedChange={setAlert} hint="Campana y correo a Finanzas, contado en horas hábiles desde que el cliente informó el pago." />
        {alert ? <ChoiceGroup label="Avisar a las" name="alert_minutes" options={options(settings.options.alert_minutes, (value) => `${minutesLabel(value)} hábiles`)} defaultValue={String(settings.alert_minutes)} /> : <input type="hidden" name="alert_minutes" value={settings.alert_minutes} />}
      </section>
      <section className="grid gap-3 rounded-tile border border-line p-4">
        <SwitchField label="Cancelar y liberar cupos si no se valida" name="auto_cancel" checked={cancel} onCheckedChange={setCancel} hint={`El cliente recibe un correo ${minutesLabel(settings.client_warning_minutes)} antes. Si sube la constancia, el pedido no se cancela.`} />
        {cancel ? <ChoiceGroup label="Cancelar a las" name="cancel_hours" options={options(settings.options.cancel_hours, (value) => `${value} h`)} defaultValue={String(settings.cancel_hours)} /> : <input type="hidden" name="cancel_hours" value={settings.cancel_hours} />}
      </section>
      <section className="grid gap-3 rounded-tile border border-line p-4">
        <p className="text-[13px] font-semibold text-fg">Escalamiento cuando el cliente sube la constancia</p>
        <ChoiceGroup label="Recordar a Finanzas si sigue sin validar" name="reminder_minutes" options={options(settings.options.reminder_minutes, (value) => `${minutesLabel(value)} hábil${value > 60 ? "es" : ""}`)} defaultValue={String(settings.reminder_minutes)} />
        <ChoiceGroup label="Escalar a Gerente y Administrador después" name="escalate_minutes" options={options(settings.options.escalate_minutes, (value) => `${minutesLabel(value)} más`)} defaultValue={String(settings.escalate_minutes)} />
      </section>
    </div>
  );
}

export function TransferSettingsCard({ settings, manage, index }: { settings: TransferValidationSettings; manage: boolean; index: number }) {
  const total = settings.reminder_minutes + settings.escalate_minutes;
  return (
    <SectionCard
      index={index}
      icon={Landmark}
      tone="t4"
      title="Transferencias y depósitos"
      updated={settings.updated_at}
      action={
        <span className="flex items-center gap-1">
          <InfoTip label="Cómo se cuenta">Los plazos en horas hábiles corren solo dentro del horario de atención ({settings.business_hours.summary}). La cancelación cuenta horas corridas desde que el cliente informó el pago.</InfoTip>
          {manage && (
            <EditSection section="transfer-validation" version={settings.lock_version} title="Transferencias y depósitos" description="Qué pasa con los pagos por transferencia, Yape o Plin del sitio mientras Finanzas los valida." action={updateTransferValidation}>
              <Editor settings={settings} />
            </EditSection>
          )}
        </span>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <StateTile icon={BellRing} tone="t1" title="Aviso a Finanzas" on={settings.alert_finance} detail={settings.alert_finance ? `A las ${minutesLabel(settings.alert_minutes)} hábiles sin validar` : "Finanzas solo ve el pago en Por validar"} />
        <StateTile icon={TimerOff} tone="bad" title="Cancelación automática" on={settings.auto_cancel} detail={settings.auto_cancel ? `A las ${settings.cancel_hours} h sin validar, con aviso al cliente ${minutesLabel(settings.client_warning_minutes)} antes` : "El pedido espera hasta que Finanzas valide o rechace"} />
      </div>
      <p className="mb-2 mt-4 flex items-center gap-1.5 text-[12.5px] font-semibold text-fg-2">
        <Clock3 size={14} className="text-fg-3" />
        Si el cliente sube su constancia
      </p>
      <ol className="grid gap-2.5 sm:grid-cols-3">
        <Step index={0} icon={FileCheck2} tone="t1" when="Al subirla" title="Campana y correo a Finanzas" detail="El pedido pasa a Constancia recibida y se pausa la cancelación." />
        <Step index={1} icon={BellRing} tone="warn" when={`+${minutesLabel(settings.reminder_minutes)}`} title="Recordatorio a Finanzas" detail="Si la constancia sigue sin validar." />
        <Step index={2} icon={UsersRound} tone="bad" when={`+${minutesLabel(total)}`} title="Gerente y Administrador" detail="Campana y correo; en Por validar el tiempo sale en rojo." />
      </ol>
      {!settings.business_hours.configured && (
        <p className={cn("mt-3 flex items-center gap-2 rounded-[12px] bg-[color-mix(in_srgb,var(--warn)_12%,var(--surface))] px-3 py-2 text-[12.5px] text-fg")}>
          <ShieldAlert size={15} className="flex-none text-warn" />
          Sin horario de atención cargado, las horas hábiles se cuentan de lunes a viernes de 08:00 a 19:00.
        </p>
      )}
    </SectionCard>
  );
}
