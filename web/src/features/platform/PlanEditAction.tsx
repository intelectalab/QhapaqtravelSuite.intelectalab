"use client";

import { Pencil } from "lucide-react";
import { useActionState, useState } from "react";
import { updatePlan, type StatusState } from "@/app/plataforma/actions";
import { Button } from "@/components/ui/Button";
import { SidePanel } from "@/components/ui/SidePanel";
import { TextField } from "@/components/ui/TextField";
import { FormError } from "@/features/auth/AuthForms";
import type { PlanSummary } from "@/lib/platform";
import { PLAN_LIMITS } from "./planLimits";

const initial: StatusState = { message: null, done: false };

export function PlanEditAction({ plan, supportLevel, agencies }: { plan: PlanSummary; supportLevel: string | null; agencies: number }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (previous: StatusState, form: FormData) => {
    const result = await updatePlan(previous, form);
    if (result.done) setOpen(false);
    return result;
  }, initial);

  return (
    <>
      <Button iconOnlyOnMobile icon={<Pencil size={16} />} onClick={() => setOpen(true)}>
        Editar plan
      </Button>
      <SidePanel
        open={open}
        onOpenChange={setOpen}
        title={`Editar plan ${plan.name}`}
        description={agencies > 0 ? `${agencies === 1 ? "1 agencia usa" : `${agencies} agencias usan`} este plan. Los cambios de precio rigen desde su siguiente renovación; los límites se aplican de inmediato.` : "Ninguna agencia usa este plan todavía."}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="plan-edit" variant="primary" disabled={pending}>
              {pending ? "Un momento…" : "Guardar cambios"}
            </Button>
          </>
        }
      >
        <form id="plan-edit" action={action} className="flex flex-col gap-4">
          <FormError message={state.message} />
          <input type="hidden" name="code" value={plan.code} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Precio mensual (S/)" name="price_month" type="number" min={0} step="0.01" required defaultValue={plan.price_month} />
            <TextField label="Precio anual (S/)" name="price_year" type="number" min={0} step="0.01" required defaultValue={plan.price_year} />
            <TextField label="Días de prueba" name="trial_days" type="number" min={0} max={60} required defaultValue={plan.trial_days} />
            <TextField label="Soporte" name="support_level" maxLength={80} defaultValue={supportLevel ?? ""} />
          </div>
          <div>
            <p className="mb-1 text-[13px] font-semibold">Límites</p>
            <p className="mb-3 text-[12.5px] text-fg-3">Déjalo vacío para que no tenga límite. Pon 0 si el plan no lo incluye.</p>
            <div className="grid grid-cols-2 gap-3">
              {PLAN_LIMITS.map((info) => (
                <TextField
                  key={info.metric}
                  label={info.unit ? `${info.label} (${info.unit})` : info.label}
                  name={`limit_${info.metric}`}
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Sin límite"
                  defaultValue={plan.limits[info.metric] ?? ""}
                />
              ))}
            </div>
          </div>
        </form>
      </SidePanel>
    </>
  );
}
