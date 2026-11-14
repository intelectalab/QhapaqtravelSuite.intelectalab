"use client";

import { Check, FileCheck2, Plug, ShieldAlert } from "lucide-react";
import { selectOse } from "@/app/(backoffice)/finanzas/facturacion/ose-actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { cn } from "@/lib/cn";
import { OSE_STEPS, oseProgress, type AgencyOse, type OseStatus } from "@/lib/financeProviders";
import { formatDateTime } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";

export function OseProgress({ status }: { status: OseStatus }) {
  const done = oseProgress(status.step);

  return (
    <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Avance de la conexión con el OSE">
      {OSE_STEPS.map((item, index) => {
        const complete = index < done;
        const current = index === done;
        return (
          <li key={item.label} className={cn("flex items-center gap-2 rounded-[10px] px-2.5 py-2 text-[12.5px] transition", complete ? "bg-[color-mix(in_srgb,var(--ok)_12%,transparent)] text-fg" : current ? "bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] font-semibold text-fg" : "bg-surface-2 text-fg-3")}>
            <span className={cn("grid h-5 w-5 flex-none place-items-center rounded-full text-[11px] font-bold", complete ? "bg-ok text-white" : current ? "bg-warn text-white" : "bg-line text-fg-3")}>{complete ? <Check size={12} /> : index + 1}</span>
            {item.label}
          </li>
        );
      })}
    </ol>
  );
}

function OseChooseAction({ data }: { data: AgencyOse }) {
  const options = [{ value: "", label: "Sin OSE (modo simulado)" }, ...data.options.map((option) => ({ value: option.code, label: option.name }))];

  return (
    <PanelAction<StepResult>
      label={data.provider ? "Cambiar OSE" : "Elegir OSE"}
      formId="ose-select"
      title="Proveedor de facturación electrónica"
      description="Elige uno de los OSE homologados por KipuControl. Tu RUC lo designa ante SUNAT; después KipuControl carga tus credenciales y prueba la conexión."
      submitLabel="Guardar"
      action={selectOse}
      initial={{ message: null, done: false }}
      trigger={(open) => (
        <Button variant="secondary" size="sm" icon={<Plug size={14} />} onClick={open}>
          {data.provider ? "Cambiar OSE" : "Elegir OSE"}
        </Button>
      )}
    >
      {() => (
        <div className="flex flex-col gap-3">
          <SelectField label="OSE" name="code" options={options} defaultValue={data.provider?.code ?? ""} />
          {data.options.length === 0 && <p className="text-[12.5px] text-fg-3">KipuControl todavía no homologa ningún OSE. Mientras tanto se emite en modo simulado.</p>}
          {data.provider && <p className="text-[12.5px] text-fg-2">Al cambiar de OSE se borran las credenciales cargadas y KipuControl debe volver a cargarlas y probar la conexión.</p>}
        </div>
      )}
    </PanelAction>
  );
}

export function OseNotice({ data }: { data: AgencyOse }) {
  const connected = data.mode === "conectado";

  return (
    <section aria-label="Facturación electrónica" className={cn("mb-5 rounded-card border px-4 py-3.5", connected ? "border-[color-mix(in_srgb,var(--ok)_30%,transparent)] bg-[color-mix(in_srgb,var(--ok)_7%,var(--surface))]" : "border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_9%,var(--surface))]")} data-testid="ose-notice" data-mode={data.mode}>
      <header className="mb-3 flex flex-wrap items-start gap-3">
        <span className={cn("grid h-9 w-9 flex-none place-items-center rounded-xl text-white", connected ? "bg-ok" : "bg-warn")}>{connected ? <FileCheck2 size={18} /> : <ShieldAlert size={18} />}</span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <b className="text-[14px] font-semibold">{connected ? "Emisión electrónica conectada" : "Modo simulado"}</b>
            {data.provider && <Badge tone={data.provider.status === "homologado" ? "t1" : "warn"}>{data.provider.name}</Badge>}
          </span>
          <span className="mt-0.5 block text-[13px] text-fg-2">{data.message}</span>
          {data.last_test_at && <span className="mt-0.5 block text-[12px] text-fg-3">Última prueba de conexión: {formatDateTime(data.last_test_at)}</span>}
        </span>
        {data.can_choose && <OseChooseAction data={data} />}
      </header>
      <OseProgress status={data} />
    </section>
  );
}
