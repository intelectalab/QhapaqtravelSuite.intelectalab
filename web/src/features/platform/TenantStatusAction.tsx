"use client";

import { CirclePause, CirclePlay } from "lucide-react";
import { useActionState, useState } from "react";
import { changeTenantStatus, type StatusState } from "@/app/plataforma/actions";
import { RowIcon } from "@/components/table/RowActions";
import { Button } from "@/components/ui/Button";
import { SidePanel } from "@/components/ui/SidePanel";
import { TextArea } from "@/components/ui/TextArea";
import { FormError } from "@/features/auth/AuthForms";
import type { TenantSummary } from "@/lib/platform";

const COPY = {
  suspend: {
    button: "Suspender",
    title: "Suspender agencia",
    confirm: "Suspender agencia",
    description: (tenant: TenantSummary) =>
      `${tenant.users === 1 ? "El único usuario" : `Los ${tenant.users} usuarios`} de ${tenant.name} no ${tenant.users === 1 ? "podrá" : "podrán"} ingresar y las sesiones abiertas se cerrarán. Los datos se conservan y puedes reactivarla cuando quieras.`,
    placeholder: "Por ejemplo: tres facturas de suscripción vencidas.",
  },
  reactivate: {
    button: "Reactivar",
    title: "Reactivar agencia",
    confirm: "Reactivar agencia",
    description: (tenant: TenantSummary) => `Los usuarios de ${tenant.name} podrán volver a ingresar con su plan ${tenant.plan?.name ?? "actual"}.`,
    placeholder: "Por ejemplo: pago regularizado.",
  },
};

const initial: StatusState = { message: null, done: false };

export function TenantStatusAction({ tenant, iconOnly = false }: { tenant: TenantSummary; iconOnly?: boolean }) {
  const mode = tenant.status === "suspendido" ? "reactivate" : "suspend";
  const copy = COPY[mode];
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (previous: StatusState, form: FormData) => {
    const result = await changeTenantStatus(previous, form);
    if (result.done) setOpen(false);
    return result;
  }, initial);

  return (
    <>
      {iconOnly ? (
        <RowIcon tone={mode === "suspend" ? "delete" : "neutral"} label={copy.button} icon={mode === "suspend" ? <CirclePause size={15} /> : <CirclePlay size={15} />} onClick={() => setOpen(true)} />
      ) : (
        <Button variant={mode === "suspend" ? "secondary" : "primary"} iconOnlyOnMobile icon={mode === "suspend" ? <CirclePause size={16} /> : <CirclePlay size={16} />} onClick={() => setOpen(true)}>
          {copy.button}
        </Button>
      )}
      <SidePanel
        open={open}
        onOpenChange={setOpen}
        title={copy.title}
        description={copy.description(tenant)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form={`tenant-status-${tenant.code}`} variant="primary" disabled={pending}>
              {pending ? "Un momento…" : copy.confirm}
            </Button>
          </>
        }
      >
        <form id={`tenant-status-${tenant.code}`} action={action} className="flex flex-col gap-4">
          <FormError message={state.message} />
          <input type="hidden" name="tenant" value={tenant.code} />
          <input type="hidden" name="mode" value={mode} />
          <TextArea label="Motivo" name="reason" required minLength={5} maxLength={500} placeholder={copy.placeholder} hint="Queda registrado en la auditoría de la plataforma." autoFocus />
        </form>
      </SidePanel>
    </>
  );
}
