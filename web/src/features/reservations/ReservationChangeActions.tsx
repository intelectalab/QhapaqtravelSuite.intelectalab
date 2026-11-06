"use client";

import { CalendarClock, Check, CircleAlert, CircleCheck, SlidersHorizontal, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { previewChange, previewReschedule, reservationStep, type ReservationState } from "@/app/(backoffice)/reservas/actions";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import { CHANGE_TYPE, type ChangeImpact, type ChangeOptions, type ReschedulePlan, type ReservationChange } from "@/lib/reservations";

const initial: ReservationState = { message: null, done: false };

function ChangeFields({ code, currency, options }: { code: string; currency: string; options: ChangeOptions }) {
  const [type, setType] = useState("pax");
  const [extra, setExtra] = useState("1");
  const [product, setProduct] = useState("");
  const [date, setDate] = useState("");
  const [impact, setImpact] = useState<ChangeImpact | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [delta, setDelta] = useState("");
  const [touched, setTouched] = useState(false);
  const [applyNow, setApplyNow] = useState(options.can_approve);

  useEffect(() => {
    if (type === "servicio" && (!product || !date)) return;
    const timer = setTimeout(async () => {
      const result = await previewChange(code, { type, extra_pax: type === "pax" ? Number(extra) || 1 : undefined, product_code: type === "servicio" ? product : undefined, service_date: type === "servicio" ? date : undefined });
      setImpact(result.impact);
      setError(result.message);
      if (result.impact && !touched) setDelta(result.impact.suggested ? String(result.impact.suggested) : "");
    }, 300);
    return () => clearTimeout(timer);
  }, [code, type, extra, product, date, touched]);

  const amount = Number(delta) || 0;

  return (
    <>
      <ChoiceGroup label="Qué cambia" name="type" options={Object.entries(CHANGE_TYPE).map(([value, label]) => ({ value, label }))} defaultValue="pax" onChange={(value) => { setType(value); setTouched(false); setImpact(null); setDelta(""); }} />

      {type === "pax" && <TextField label="Pasajeros que se suman" name="extra_pax" type="number" min={1} max={40} value={extra} onChange={(event) => setExtra(event.target.value)} hint={`Hoy viajan ${options.pax}.`} />}

      {type === "servicio" && (
        <div className="grid grid-cols-[1.4fr_1fr] gap-3">
          <SelectField label="Servicio" name="product_code" options={options.products.map((item) => ({ value: item.code, label: item.name }))} placeholder="Elegir" onChange={setProduct} />
          <TextField label="Fecha" name="service_date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
      )}

      {(impact || error) && (
        <div key={`${type}-${impact?.note ?? error}`} className={cn("flex animate-[rise-in_380ms_cubic-bezier(0.22,1,0.36,1)_backwards] items-start gap-3 rounded-xl px-3.5 py-3 text-[13px]", impact?.available === false || error ? "bg-[color-mix(in_srgb,var(--bad)_9%,transparent)]" : "bg-[color-mix(in_srgb,var(--ok)_9%,transparent)]")}>
          <span className={cn("mt-0.5 flex-none", impact?.available === false || error ? "text-bad" : "text-ok")}>{impact?.available === false || error ? <CircleAlert size={17} /> : <CircleCheck size={17} />}</span>
          <span className="text-fg-2">{error ?? impact?.note}</span>
        </div>
      )}

      <TextField
        label={`Impacto en el total (${currency})`}
        name="delta"
        type="number"
        step="0.01"
        value={delta}
        onChange={(event) => { setDelta(event.target.value); setTouched(true); }}
        hint={amount > 0 ? `Se crea una cuota de ${formatMoney(amount, currency)}.` : amount < 0 ? `Se descuenta ${formatMoney(Math.abs(amount), currency)} de las cuotas abiertas; lo que sobre queda como saldo a favor.` : "Positivo es un cargo; negativo, un saldo a favor del cliente."}
      />
      <TextArea label="Descripción" name="description" rows={3} required minLength={3} maxLength={500} placeholder="Qué pidió el cliente y por qué cambia el precio." />
      {options.can_approve ? (
        <SwitchField label="Aprobar y aplicar ahora" hint="Como supervisor, el cambio se aplica al guardar." name="apply_now" checked={applyNow} onCheckedChange={setApplyNow} />
      ) : (
        <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[12.5px] text-fg-2">Quedará pendiente hasta que Gerencia lo apruebe.</p>
      )}
    </>
  );
}

export function ReservationModifyAction({ code, currency, options }: { code: string; currency: string; options: ChangeOptions }) {
  const router = useRouter();
  return (
    <PanelAction<ReservationState>
      label="Modificar"
      icon={<SlidersHorizontal size={16} />}
      formId={`reservation-change-${code}`}
      title="Modificar reserva"
      description="Pasajeros, servicios o ajustes que cambian el precio. Queda registrado con su impacto."
      submitLabel="Guardar modificación"
      action={reservationStep}
      initial={initial}
      onDone={() => router.refresh()}
      trigger={(open) => <Button iconOnly icon={<SlidersHorizontal size={16} />} label="Modificar" onClick={open} className="transition-transform duration-300 hover:-translate-y-0.5" />}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={code} />
          <input type="hidden" name="step" value="change" />
          <ChangeFields code={code} currency={currency} options={options} />
        </>
      )}
    </PanelAction>
  );
}

function Decision({ code, change, approve }: { code: string; change: ReservationChange; approve: boolean }) {
  const router = useRouter();
  return (
    <PanelAction<ReservationState>
      label={approve ? "Aprobar" : "Rechazar"}
      icon={approve ? <Check size={15} /> : <X size={15} />}
      size="sm"
      variant={approve ? "primary" : "ghost"}
      formId={`change-${approve ? "approve" : "reject"}-${change.id}`}
      title={approve ? "Aprobar y aplicar" : "Rechazar modificación"}
      description={change.description}
      submitLabel={approve ? "Aplicar" : "Rechazar"}
      action={reservationStep}
      initial={initial}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={code} />
          <input type="hidden" name="change" value={change.id} />
          <input type="hidden" name="step" value={approve ? "approve_change" : "reject_change"} />
          {approve ? <p className="text-[13.5px] text-fg-2">Se aplica el cambio y su impacto en las cuotas.</p> : <TextArea label="Motivo" name="note" rows={3} required minLength={3} maxLength={500} />}
        </>
      )}
    </PanelAction>
  );
}

export function PendingChanges({ code, currency, changes, canApprove }: { code: string; currency: string; changes: ReservationChange[]; canApprove: boolean }) {
  if (changes.length === 0) return null;
  return (
    <div className="mb-5 flex flex-col gap-2">
      {changes.map((change, index) => {
        const amount = Number(change.delta_amount);
        return (
          <div key={change.id} style={{ animationDelay: `${index * 60}ms` }} className="lift flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-wrap items-center gap-3 rounded-card border border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-4 py-3 text-[13.5px]">
            <span className="min-w-0 flex-1">
              <b className="font-semibold">Modificación pendiente · {CHANGE_TYPE[change.type] ?? change.type}</b>
              <span className="block text-[12.5px] text-fg-2">
                {change.description}
                {change.product ? ` · ${change.product}` : ""}
                {change.service_date ? ` el ${formatDate(change.service_date)}` : ""}
                {change.extra_pax ? ` · +${change.extra_pax} pax` : ""} · {amount >= 0 ? "+" : "−"}
                {formatMoney(Math.abs(amount), currency)} · pedida por {change.requested_by}
              </span>
            </span>
            {canApprove && (
              <span className="flex gap-2">
                <Decision code={code} change={change} approve={false} />
                <Decision code={code} change={change} approve />
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function RescheduleFields({ code }: { code: string }) {
  const [start, setStart] = useState("");
  const [plan, setPlan] = useState<ReschedulePlan | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const result = await previewReschedule(code, start || null);
      setPlan(result.plan);
      setError(result.message);
      if (!start && result.plan) setStart(result.plan.suggested);
    }, 250);
    return () => clearTimeout(timer);
  }, [code, start]);

  return (
    <>
      <TextField label="Nueva fecha de inicio" name="new_start" type="date" required value={start} onChange={(event) => setStart(event.target.value)} hint={plan ? `Hoy empieza el ${formatDate(plan.from)}. Todo el viaje se mueve ${Math.abs(plan.shift)} ${Math.abs(plan.shift) === 1 ? "día" : "días"} ${plan.shift >= 0 ? "después" : "antes"}.` : undefined} />
      {error && <p className="text-[13px] text-bad">{error}</p>}
      {plan && (
        <section className="flex flex-col gap-2">
          {plan.lines.map((line, index) => (
            <div key={`${line.id}-${line.new_date}`} style={{ animationDelay: `${index * 50}ms` }} className={cn("flex animate-[rise-in_380ms_cubic-bezier(0.22,1,0.36,1)_backwards] items-start gap-3 rounded-xl px-3.5 py-2.5 text-[13px]", line.ok ? "bg-surface-2" : "bg-[color-mix(in_srgb,var(--bad)_9%,transparent)]")}>
              <span className={cn("mt-0.5 flex-none", line.ok ? "text-ok" : "text-bad")}>{line.ok ? <CircleCheck size={16} /> : <CircleAlert size={16} />}</span>
              <span className="min-w-0 flex-1">
                <b className="block truncate font-semibold">{line.name}</b>
                <span className="text-fg-3">
                  {formatDate(line.date)} → {formatDate(line.new_date)} · {line.note}
                </span>
              </span>
              {line.new_price !== line.price && <span className="flex-none font-mono text-[12.5px]">{formatMoney(line.new_price, plan.currency)}</span>}
            </div>
          ))}
          <p className={cn("text-[12.5px]", plan.blocked ? "text-bad" : "text-fg-2")}>
            {plan.blocked ?? (plan.diff > 0 ? `Por temporada sube ${formatMoney(plan.diff, plan.currency)}: se crea una cuota por la diferencia.` : plan.diff < 0 ? `Por temporada baja ${formatMoney(Math.abs(plan.diff), plan.currency)}.` : "La tarifa no cambia. Los servicios vuelven a pendiente y los vouchers emitidos se anulan.")}
          </p>
        </section>
      )}
      <TextArea label="Motivo" name="reason" rows={3} required minLength={3} maxLength={500} placeholder="Por ejemplo: el cliente cambió su vuelo." />
    </>
  );
}

export function ReservationRescheduleAction({ code }: { code: string }) {
  const router = useRouter();
  return (
    <PanelAction<ReservationState>
      label="Reprogramar"
      icon={<CalendarClock size={16} />}
      formId={`reservation-reschedule-${code}`}
      title="Reprogramar viaje"
      description="Mueve todas las fechas del viaje y revisa la disponibilidad en la nueva fecha. El cliente recibe un aviso por correo."
      submitLabel="Reprogramar"
      action={reservationStep}
      initial={initial}
      onDone={() => router.refresh()}
      trigger={(open) => <Button iconOnly icon={<CalendarClock size={16} />} label="Reprogramar" onClick={open} className="transition-transform duration-300 hover:-translate-y-0.5" />}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={code} />
          <input type="hidden" name="step" value="reschedule" />
          <RescheduleFields code={code} />
        </>
      )}
    </PanelAction>
  );
}
