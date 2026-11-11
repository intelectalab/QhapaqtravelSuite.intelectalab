"use client";

import { CalendarCheck2, CalendarX2, CircleCheck, CircleSlash, Lock, Play, Users } from "lucide-react";
import { useState, useTransition } from "react";
import { simulateRules } from "@/app/(backoffice)/admin/reglas/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { FieldError } from "@/components/ui/FieldError";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import type { RuleSimulation, SimulatorOptions } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";

const DAY_OK = ["disponible"];

const MODES: Record<string, string> = { total: "Pago total", adelanto: "Adelanto", pagar_despues: "Pagar después" };

function DayCard({ day }: { day: RuleSimulation["day"] }) {
  const ok = DAY_OK.includes(day.status);
  const Icon = ok ? CalendarCheck2 : CalendarX2;
  return (
    <div className={cn("lift flex items-start gap-3 rounded-[14px] border px-4 py-3", ok ? "border-ok/30 bg-[color-mix(in_srgb,var(--ok)_7%,var(--surface))]" : "border-bad/30 bg-[color-mix(in_srgb,var(--bad)_7%,var(--surface))]")}>
      <Icon size={20} className={ok ? "text-ok" : "text-bad"} />
      <span className="text-[13px]">
        <b className="block">{day.label}</b>
        <span className="text-fg-3">{day.left !== null ? `${day.left} cupos libres` : "Sin control de cupos"}{day.note ? ` · ${day.note}` : ""}</span>
      </span>
    </div>
  );
}

function QuoteCard({ result }: { result: RuleSimulation }) {
  const { quote } = result;
  return (
    <div className="lift rounded-[14px] border border-line bg-surface px-4 py-3 text-[13px]">
      <ul className="flex flex-col gap-1.5">
        {quote.lines.filter((line) => line.kind !== "info").map((line) => (
          <li key={line.key} className={cn("flex justify-between gap-3", line.removed && "text-fg-3 line-through")}>
            <span>{line.label}{line.qty > 1 ? ` × ${line.qty}` : ""}</span>
            <span className="font-mono">{formatMoney(Number(line.amount), quote.currency)}</span>
          </li>
        ))}
        {quote.adjustments.map((adjustment) => (
          <li key={adjustment.key} className="flex justify-between gap-3 text-fg-2">
            <span>{adjustment.label}</span>
            <span className="font-mono">{formatMoney(Number(adjustment.amount), quote.currency)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex justify-between border-t border-line-2 pt-2 text-[14px] font-bold">
        <span>Total</span>
        <span className="font-mono">{formatMoney(Number(quote.total), quote.currency)}</span>
      </p>
      <p className="mt-1 text-[12.5px] text-fg-3">
        {MODES[quote.payment_mode] ?? quote.payment_mode}
        {quote.payment_mode === "adelanto" ? ` · ${quote.deposit_pct} % ahora (${formatMoney(Number(quote.deposit), quote.currency)}), saldo ${quote.balance_due ?? "al viajar"}` : ""}
        {quote.hold_hours ? ` · se reserva ${quote.hold_hours} h sin pagar` : ""}
      </p>
      {quote.modes.length > 1 && <p className="mt-1 text-[12px] text-fg-3">Modalidades disponibles: {quote.modes.map((mode) => MODES[mode] ?? mode).join(", ")}</p>}
    </div>
  );
}

function RulesCard({ rules }: { rules: RuleSimulation["rules"] }) {
  const groups = [...new Set(rules.map((rule) => rule.group))];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {groups.map((group) => (
        <div key={group} className="rounded-[14px] bg-surface-2 px-3.5 py-2.5">
          <p className="mb-1.5 text-[12.5px] font-semibold text-fg-3">{group}</p>
          <ul className="flex flex-col gap-1">
            {rules.filter((rule) => rule.group === group).map((rule) => {
              const Icon = rule.effective ? CircleCheck : rule.plan_allows ? CircleSlash : Lock;
              return (
                <li key={rule.code} className="flex items-center gap-2 text-[12.5px]" title={rule.code}>
                  <Icon size={14} className={rule.effective ? "text-ok" : rule.plan_allows ? "text-fg-3" : "text-warn"} />
                  <span className={rule.effective ? "" : "text-fg-3"}>{rule.name}</span>
                  {!rule.plan_allows && <span className="text-[11px] text-warn">no incluida en el plan</span>}
                  {rule.overridden && <span className="text-[11px] text-fg-3">apagada para este producto</span>}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function RuleSimulator({ options }: { options: SimulatorOptions }) {
  const [result, setResult] = useState<RuleSimulation | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (form: FormData) =>
    start(async () => {
      const response = await simulateRules(form);
      setMessage(response.ok ? null : response.message);
      setResult(response.ok ? response.data : null);
    });

  return (
    <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
      <form action={run} className="flex flex-col gap-3">
        <SelectField label="Producto" name="product" options={options.products} searchable placeholder="Elige un producto" defaultValue={options.products[0]?.value} />
        <TextField label="Fecha del servicio" name="date" type="date" required defaultValue={options.today} />
        <div className="grid grid-cols-3 gap-2">
          <TextField label="Adultos" name="adt" type="number" min={0} max={50} required defaultValue="2" icon={<Users size={16} />} />
          <TextField label="Niños" name="chd" type="number" min={0} max={50} defaultValue="0" />
          <TextField label="Infantes" name="inf" type="number" min={0} max={50} defaultValue="0" />
        </div>
        <ChoiceGroup label="Moneda" name="currency" options={[{ value: "PEN", label: "S/" }, { value: "USD", label: "US$" }]} defaultValue="PEN" />
        <SelectField label="Modalidad de pago" name="payment_mode" options={Object.entries(MODES).map(([value, label]) => ({ value, label }))} clearable placeholder="La que aplique por defecto" />
        <SelectField label="Canal de venta" name="channel" options={["Directo", "Corporativo", "B2B", "E-commerce"].map((value) => ({ value, label: value }))} defaultValue="Directo" />
        <TextField label="Código promocional (opcional)" name="promo_code" maxLength={40} />
        <SelectField label="Plan a simular" name="plan" options={options.plans.map((plan) => ({ value: plan, label: plan === options.current_plan ? `${plan} (tu plan)` : plan }))} clearable placeholder={`Tu plan (${options.current_plan})`} hint="Solo cambia el cálculo: la suscripción no se toca." />
        <FieldError message={message} />
        <Button type="submit" icon={<Play size={15} />} disabled={pending}>
          {pending ? "Simulando…" : "Simular"}
        </Button>
      </form>
      <div className="flex flex-col gap-3">
        {result ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="t1" dot={false}>{result.product.name}</Badge>
              <Badge tone={result.current_plan ? "mute" : "violet"} dot={false}>{result.current_plan ? "Tu plan" : `Simulado como ${result.plan}`}</Badge>
              <Badge tone={result.pax.ok ? "ok" : "bad"} dot={false}>{result.pax.ok ? `${result.pax.seats} pasajeros válidos` : "Grupo no válido"}</Badge>
            </div>
            <DayCard day={result.day} />
            {[...result.pax.errors, ...result.quote.warnings.filter((warning) => !result.pax.errors.includes(warning)), ...(result.warning ? [result.warning] : [])].map((warning) => (
              <p key={warning} className="rounded-[12px] bg-[color-mix(in_srgb,var(--warn)_10%,var(--surface))] px-3.5 py-2 text-[12.5px] text-warn">{warning}</p>
            ))}
            <QuoteCard result={result} />
            <RulesCard rules={result.rules} />
          </>
        ) : (
          <div className="grid h-full min-h-[220px] place-items-center rounded-[14px] border border-dashed border-line px-6 text-center text-[13px] text-fg-3">
            Elige un producto y un escenario para ver qué día queda disponible, cuánto se cobra y qué reglas intervienen.
          </div>
        )}
      </div>
    </div>
  );
}
