"use client";

import { Ban, CalendarCheck2, Lock, PlayCircle, Plus, Target, Trophy } from "lucide-react";
import { useState } from "react";
import { saveTarget, targetStep } from "@/app/(backoffice)/crm/metas/actions";
import { RowIcon } from "@/components/table/RowActions";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import { HEALTH, type SalesTarget, type TargetsOverview } from "@/lib/targets";

const initial: StepResult = { message: null, done: false };

function GoalFields({ target, withBonus }: { target?: SalesTarget; withBonus: boolean }) {
  return (
    <>
      <TextField label="Ventas (S/)" name="goal_sales" type="number" step="0.01" min="1" required defaultValue={target ? String(target.goals.sales) : undefined} icon={<Target size={17} />} />
      <div className="grid grid-cols-3 gap-3">
        <TextField label="Reservas" name="goal_bookings" type="number" min="0" defaultValue={target?.goals.bookings !== null && target ? String(target.goals.bookings) : undefined} />
        <TextField label="Margen (S/)" name="goal_margin" type="number" step="0.01" min="0" defaultValue={target?.goals.margin !== null && target ? String(target.goals.margin) : undefined} />
        <TextField label="Conversión %" name="goal_conversion" type="number" step="0.1" min="0" max="100" defaultValue={target?.goals.conversion !== null && target ? String(target.goals.conversion) : undefined} />
      </div>
      {withBonus && <TextField label="Bono base (S/)" name="bonus_amount" type="number" step="0.01" min="0" defaultValue={target?.bonus ? String(target.bonus.amount) : undefined} hint="Se paga por tramos: desde el 90 % de la meta de ventas." icon={<Trophy size={17} />} />}
    </>
  );
}

export function TargetCreateAction({ options }: { options: NonNullable<TargetsOverview["options"]> }) {
  const [scope, setScope] = useState<"asesor" | "sede" | "equipo">("asesor");
  const [activate, setActivate] = useState(true);
  const scopes = { asesor: options.advisors, sede: options.sedes, equipo: options.teams };
  return (
    <PanelAction<StepResult> label="Nueva meta" icon={<Plus size={16} strokeWidth={2.4} />} variant="primary" formId="nueva-meta" title="Nueva meta comercial" description="Una meta por asesor, sede o equipo en cada período." submitLabel="Crear meta" action={saveTarget} initial={initial}>
      {() => (
        <>
          <ChoiceGroup label="Alcance" name="scope_type" options={[{ value: "asesor", label: "Asesor" }, { value: "equipo", label: "Equipo" }, { value: "sede", label: "Sede" }]} defaultValue="asesor" onChange={(value) => setScope(value as typeof scope)} />
          <SelectField key={scope} label={scope === "asesor" ? "Asesor" : scope === "equipo" ? "Equipo" : "Sede"} name="scope_id" options={scopes[scope]} placeholder="Elegir" />
          <SelectField label="Período" name="period" options={options.periods} defaultValue={options.periods[0]?.value} />
          <GoalFields withBonus={scope === "asesor"} />
          <SwitchField label="Activar ahora" hint="Si no, queda en borrador y el asesor no la ve." name="activate" checked={activate} onCheckedChange={setActivate} />
        </>
      )}
    </PanelAction>
  );
}

export function TargetAdjustAction({ target, lockPct, canReduceLate }: { target: SalesTarget; lockPct: number; canReduceLate: boolean }) {
  const locked = target.status === "vigente" && target.elapsed_pct > lockPct && !canReduceLate;
  const editable = target.status === "borrador" || target.status === "vigente";
  return (
    <PanelAction<StepResult>
      label="Ajustar"
      formId={`ajustar-${target.code}`}
      title={`Ajustar meta · ${target.scope.name}`}
      description={`${target.period_label} · ${target.code}`}
      submitLabel="Guardar ajuste"
      action={saveTarget}
      initial={initial}
      trigger={(open) => <RowIcon tone="edit" label="Ajustar meta" onClick={open} disabledHint={editable ? undefined : "Solo se ajustan metas en borrador o vigentes"} />}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={target.code} />
          {locked && (
            <p className="flex items-start gap-2 rounded-xl bg-[color-mix(in_srgb,var(--warn)_10%,var(--surface))] px-3.5 py-2.5 text-[12.5px] text-fg-2">
              <Lock size={14} className="mt-0.5 flex-none text-warn" />
              Ya pasó el {lockPct} % del período: puedes subir la meta, pero solo el administrador puede reducirla.
            </p>
          )}
          <GoalFields target={target} withBonus={target.scope_type === "asesor"} />
          <TextArea label="Motivo del ajuste" name="reason" rows={2} required minLength={5} maxLength={500} placeholder="Queda en el historial de la meta." />
        </>
      )}
    </PanelAction>
  );
}

export function TargetVoidAction({ target }: { target: SalesTarget }) {
  const allowed = target.status === "borrador" || target.status === "vigente";
  return (
    <PanelAction<StepResult>
      label="Anular"
      formId={`anular-${target.code}`}
      title="Anular meta"
      description={`${target.scope.name} · ${target.period_label}. Queda en el historial; no se borra.`}
      submitLabel="Anular"
      action={targetStep}
      initial={initial}
      trigger={(open) => <RowIcon tone="delete" label="Anular meta" icon={<Ban size={15} />} onClick={open} disabledHint={allowed ? undefined : "Esta meta ya no se puede anular"} />}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={target.code} />
          <input type="hidden" name="lock_version" value={target.lock_version} />
          <input type="hidden" name="step" value="void" />
          <TextArea label="Motivo" name="reason" rows={2} required minLength={5} maxLength={500} />
        </>
      )}
    </PanelAction>
  );
}

export function TargetDetailAction({ target, manage }: { target: SalesTarget; manage: boolean }) {
  const step = manage && target.status === "borrador" ? "activate" : manage && target.health === "por_cerrar" ? "close" : null;
  const health = HEALTH[target.health] ?? HEALTH.borrador;
  return (
    <PanelAction<StepResult>
      label="Ver"
      formId={`meta-${target.code}`}
      title={`${target.scope.name} · ${target.period_label}`}
      description={`${target.scope_label} · ${formatDate(target.period_from)} al ${formatDate(target.period_to)}`}
      submitLabel={step === "activate" ? "Activar meta" : step === "close" ? "Cerrar período" : "Listo"}
      action={step ? targetStep : async () => ({ message: null, done: true })}
      initial={initial}
      trigger={(open) => <RowIcon tone="view" label="Ver meta" onClick={open} />}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={target.code} />
          <input type="hidden" name="lock_version" value={target.lock_version} />
          {step && <input type="hidden" name="step" value={step} />}
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={target.status} />
            <Badge tone={health.tone}>{health.label}</Badge>
            {target.bonus && <Badge tone="sun" dot={false}>Bono estimado {formatMoney(target.bonus.estimated)}</Badge>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Ventas", real: formatMoney(target.actual.sales), goal: formatMoney(target.goals.sales) },
              { label: "Reservas", real: String(target.actual.bookings), goal: target.goals.bookings !== null ? String(target.goals.bookings) : "—" },
              { label: "Margen", real: formatMoney(target.actual.margin), goal: target.goals.margin !== null ? formatMoney(target.goals.margin) : "—" },
              { label: "Conversión", real: target.actual.conversion !== null ? formatPercent(target.actual.conversion) : "—", goal: target.goals.conversion !== null ? formatPercent(target.goals.conversion, 0) : "—" },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-surface-2 px-3 py-2.5">
                <p className="text-[12px] text-fg-3">{item.label}</p>
                <p className="text-[15px] font-bold">{item.real}</p>
                <p className="text-[11.5px] text-fg-3">Meta {item.goal}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="mb-1.5 text-[12.5px] font-semibold text-fg-3">Reservas que suman</p>
            {target.reservations.length === 0 ? (
              <p className="text-[13px] text-fg-3">Aún no hay reservas en el período.</p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {target.reservations.map((item) => (
                  <li key={item.code} className="flex justify-between gap-3 rounded-lg border border-line px-3 py-2 text-[12.5px]">
                    <span className="min-w-0 truncate">{item.code} · {item.title}</span>
                    <b className="font-mono">{formatMoney(item.total_pen)}</b>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {target.pipeline.length > 0 && (
            <div>
              <p className="mb-1.5 text-[12.5px] font-semibold text-fg-3">Oportunidades que cierran en el período</p>
              <ul className="flex flex-col gap-1.5">
                {target.pipeline.map((item) => (
                  <li key={item.code} className="flex justify-between gap-3 rounded-lg border border-dashed border-line px-3 py-2 text-[12.5px]">
                    <span className="min-w-0 truncate">{item.title} · {item.probability} %</span>
                    <b className="font-mono">{formatMoney(item.amount, item.currency)}</b>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {step === "close" && (
            <p className="flex items-center gap-2 rounded-xl bg-[color-mix(in_srgb,var(--violet)_10%,var(--surface))] px-3.5 py-2.5 text-[12.5px]">
              <CalendarCheck2 size={15} className="text-[var(--violet)]" /> Al cerrar, el resultado queda congelado y ya no cambia con nuevas reservas.
            </p>
          )}
          {step === "activate" && (
            <p className="flex items-center gap-2 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[12.5px]">
              <PlayCircle size={15} className="text-ok" /> Al activarla, el asesor la verá en su panel.
            </p>
          )}
        </>
      )}
    </PanelAction>
  );
}

export function ProgressBar({ progress, projection }: { progress: number; projection: number }) {
  const width = Math.min(100, progress);
  const marker = Math.min(100, projection);
  const tone = projection >= 100 ? "bg-ok" : projection >= 80 ? "bg-warn" : "bg-bad";
  return (
    <div className="group/bar relative h-2.5 rounded-full bg-surface-2" title={`Avance ${formatPercent(progress)} · proyección ${formatPercent(projection)}`}>
      <div className={`h-full origin-left rounded-full ${tone} motion-safe:animate-[fill-x_900ms_cubic-bezier(0.4,0,0.2,1)_backwards]`} style={{ width: `${width}%` }} />
      {projection > progress && <span className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-fg/40 transition-transform group-hover/bar:scale-y-125" style={{ left: `calc(${marker}% - 2px)` }} />}
    </div>
  );
}

export function PeriodPicker({ periods, value, onChange }: { periods: TargetsOverview["periods"]; value: string; onChange: (value: string) => void }) {
  return <SelectField label="Período" name="period_view" options={periods} defaultValue={value} onChange={onChange} className="w-full sm:w-[240px]" />;
}
