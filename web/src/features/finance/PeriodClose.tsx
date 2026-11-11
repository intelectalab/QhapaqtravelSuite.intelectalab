"use client";

import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { financeStep } from "@/app/(backoffice)/finanzas/actions";
import { SwitchField } from "@/components/ui/SwitchField";
import type { PeriodCheck, PeriodCloseState } from "@/lib/finance";
import { FinanceStep, SummaryBox } from "./FinanceStep";

export function ManualCheckToggle({ period, check, editable }: { period: string; check: PeriodCheck; editable: boolean }) {
  const router = useRouter();
  const [checked, setChecked] = useState(check.ok);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const change = (next: boolean) => {
    setChecked(next);
    setError(null);
    start(async () => {
      const form = new FormData();
      form.set("step", next ? "period_check" : "period_uncheck");
      form.set("key", `${period}:${check.code}`);
      const result = await financeStep({ message: null, done: false }, form);
      if (!result.done) {
        setChecked(!next);
        setError(result.message);
        return;
      }
      router.refresh();
    });
  };
  return (
    <div className="flex flex-col gap-1">
      {editable ? <SwitchField label={check.label} name={`check_${check.code}`} checked={checked} onCheckedChange={(next) => !pending && change(next)} hint={check.detail} /> : (
        <span className="text-[13px]">
          <b className="block font-semibold">{check.label}</b>
          <span className="text-[12.5px] text-fg-3">{check.detail}</span>
        </span>
      )}
      {error && <p className="text-[12.5px] text-bad">{error}</p>}
    </div>
  );
}

export function ClosePeriodAction({ state }: { state: PeriodCloseState }) {
  return (
    <FinanceStep step="period_close" itemKey={state.period} label="Cerrar periodo" icon={<Lock size={16} />} variant="primary" title={`Cerrar ${state.label.toLowerCase()}`} description="Después del cierre no se emiten comprobantes con fecha de este periodo y no hay reapertura. Se avisa por correo a Finanzas." submitLabel="Cerrar periodo">
      <SummaryBox rows={[{ label: "Periodo", value: state.label }, { label: "Controles en orden", value: `${state.done} de ${state.total}`, strong: true }]} />
      <p className="rounded-xl bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] px-3.5 py-2.5 text-[12.5px] text-fg-2">Los ajustes posteriores se registran con nota de crédito o débito en el periodo siguiente.</p>
    </FinanceStep>
  );
}
