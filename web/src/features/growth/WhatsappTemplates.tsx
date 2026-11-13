"use client";

import { BadgeCheck, CircleCheck, Clock3, FileText, MessageCircle, Pause, Play, Plus, Smartphone, XCircle } from "lucide-react";
import { useActionState, useState } from "react";
import { saveWhatsappTemplate, whatsappTemplateStep } from "@/app/(backoffice)/admin/whatsapp/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { TintTile } from "@/components/ui/Tinted";
import { formatDateTime } from "@/lib/format";
import { labelOptions, type WhatsappOverview, type WhatsappTemplate } from "@/lib/growth";
import type { StepResult } from "@/lib/server/resource";
import { KpiRow, PlanNotice, StatusPill } from "./GrowthUi";

const initial: StepResult = { message: null, done: false };

const SAMPLE: Record<string, string> = { nombre: "Ana", monto: "S/ 480.00", codigo: "RES-2026-000412", enlace: "kipu.pe/p/8XK2", destino: "Cusco" };

const fill = (body: string) => body.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/g, (_, name: string) => SAMPLE[name] ?? `[${name}]`);

function Bubble({ body }: { body: string }) {
  return (
    <div className="rounded-xl bg-[color-mix(in_srgb,var(--ok)_8%,var(--surface))] p-3">
      <p className="w-fit max-w-full whitespace-pre-line rounded-xl rounded-tl-sm bg-surface px-3 py-2 text-[13px] leading-relaxed shadow-sm">{fill(body) || "El mensaje aparece aquí."}</p>
      <p className="mt-1.5 text-[11px] text-fg-3">Vista previa con datos de ejemplo</p>
    </div>
  );
}

function TemplateForm({ overview, template }: { overview: WhatsappOverview; template?: WhatsappTemplate }) {
  const [body, setBody] = useState(template?.body ?? "");
  const { categories, purposes, langs } = overview.catalogs;
  return (
    <PanelAction<StepResult>
      label="Nueva plantilla"
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      formId={template ? `wa-${template.id}` : "wa-nueva"}
      title={template ? `Editar ${template.name}` : "Nueva plantilla de WhatsApp"}
      description={template ? "Si cambias el texto o la categoría, vuelve a la revisión de Meta." : "Se envía a Meta para su aprobación. Solo las aprobadas se pueden usar fuera de la ventana de 24 horas."}
      submitLabel={template ? "Guardar cambios" : "Enviar a revisión"}
      action={saveWhatsappTemplate}
      initial={initial}
      testId={template ? undefined : "wa-template-create"}
      trigger={template ? (open) => <RowIcon tone="edit" label="Editar plantilla" onClick={open} /> : undefined}
    >
      {() => (
        <>
          {template && <input type="hidden" name="id" value={template.id} />}
          {!template && <TextField label="Nombre" name="name" required pattern="[a-z0-9_]{3,80}" maxLength={80} icon={<FileText size={17} />} hint="Minúsculas, números y guion bajo, como en Meta: recordatorio_pago" />}
          {!template && <ChoiceGroup label="Idioma" name="lang" options={labelOptions(langs)} defaultValue="es" />}
          <SelectField label="Categoría de Meta" name="category" options={labelOptions(categories)} defaultValue={template?.category ?? "utility"} hint="Transaccional: avisos de una compra o reserva. Comercial: promociones, solo con consentimiento." />
          <SelectField label="Uso" name="purpose" options={labelOptions(purposes)} defaultValue={template?.purpose ?? "otro"} />
          <TextArea label="Texto" name="body" rows={6} required minLength={10} maxLength={1024} value={body} onChange={(event) => setBody(event.target.value)} hint="Usa variables entre llaves dobles: {{nombre}}, {{monto}}, {{enlace}}." />
          <Bubble body={body} />
        </>
      )}
    </PanelAction>
  );
}

function ReviewAction({ template }: { template: WhatsappTemplate }) {
  return (
    <PanelAction<StepResult>
      label="Respuesta de Meta"
      formId={`wa-revision-${template.id}`}
      title="Registrar respuesta de Meta"
      description={`${template.name}${template.meta_template_id ? ` · ID Meta ${template.meta_template_id}` : ""}`}
      submitLabel="Registrar respuesta"
      action={whatsappTemplateStep}
      initial={initial}
      trigger={(open) => <RowIcon tone="neutral" label="Registrar respuesta de Meta" icon={<BadgeCheck size={15} />} onClick={open} disabledHint={template.status === "enviada" ? undefined : "Solo plantillas en revisión"} />}
    >
      {() => (
        <>
          <input type="hidden" name="id" value={template.id} />
          <input type="hidden" name="step" value="review" />
          <ChoiceGroup label="Meta respondió" name="meta_status" options={[{ value: "aprobada", label: "Aprobada" }, { value: "rechazada", label: "Rechazada" }]} defaultValue="aprobada" />
          <TextField label="Motivo del rechazo" name="rejected_reason" maxLength={300} hint="Solo si Meta la rechazó." />
          <p className="text-[12.5px] text-fg-3">Mientras el número esté en modo de prueba, la revisión se simula. Con la cuenta de Meta conectada, la respuesta llega sola.</p>
          <Bubble body={template.body} />
        </>
      )}
    </PanelAction>
  );
}

function ToggleAction({ template }: { template: WhatsappTemplate }) {
  const [state, run, pending] = useActionState(whatsappTemplateStep, initial);
  const paused = template.status === "pausada";
  if (template.status !== "aprobada" && !paused) return null;
  return (
    <form action={run} className="contents">
      <input type="hidden" name="id" value={template.id} />
      <input type="hidden" name="step" value={paused ? "reanudar" : "pausar"} />
      <button type="submit" disabled={pending} title={state.message ?? (paused ? "Reanudar plantilla" : "Pausar plantilla")} aria-label={paused ? "Reanudar plantilla" : "Pausar plantilla"} className="grid h-8 w-8 place-items-center rounded-[9px] bg-surface-2 text-fg-2 transition hover:-translate-y-0.5">
        {paused ? <Play size={15} /> : <Pause size={15} />}
      </button>
    </form>
  );
}

export function WhatsappBoard({ overview }: { overview: WhatsappOverview }) {
  const { kpis, account, catalogs } = overview;
  return (
    <>
      <PlanNotice enabled={overview.enabled} feature="WhatsApp Business oficial" />
      <KpiRow>
        <TintTile icon={Smartphone} tone="t1" label="Número" value={account ? account.phone ?? account.name : "Sin conectar"} note={account?.mode ?? "Se abre en modo de prueba con la primera plantilla"} info={<p>Cuenta de WhatsApp Business registrada en la bandeja omnicanal. En modo de prueba los envíos se simulan.</p>} />
        <TintTile icon={CircleCheck} tone="ok" label="Aprobadas" value={kpis.approved} note={`de ${kpis.total} plantillas`} info={<p>Plantillas que Meta aprobó. Son las únicas que se pueden enviar fuera de la ventana de 24 horas.</p>} />
        <TintTile icon={Clock3} tone="sun" label="En revisión" value={kpis.in_review} info={<p>Plantillas enviadas a Meta, nuevas o editadas, que esperan respuesta.</p>} />
        <TintTile icon={XCircle} tone="bad" label="Rechazadas" value={kpis.rejected} info={<p>Plantillas que Meta rechazó. Edita el texto para volver a enviarlas.</p>} />
      </KpiRow>
      <DataTable
        screen="admin-whatsapp"
        rows={overview.templates}
        getKey={(template) => template.id}
        entityLabel="plantillas"
        searchText={(template) => `${template.name} ${template.body} ${template.purpose_label}`}
        searchPlaceholder="Buscar por nombre o texto"
        metrics={[
          { id: "aprobada", label: "Aprobadas", tone: "ok", icon: <CircleCheck size={18} />, matches: (template) => template.status === "aprobada" },
          { id: "enviada", label: "En revisión", tone: "sun", icon: <Clock3 size={18} />, matches: (template) => template.status === "enviada" },
          { id: "rechazada", label: "Rechazadas", tone: "bad", icon: <XCircle size={18} />, matches: (template) => template.status === "rechazada" },
        ]}
        filters={[
          { id: "purpose", label: "Uso", options: labelOptions(catalogs.purposes), value: (template) => template.purpose },
          { id: "category", label: "Categoría", options: labelOptions(catalogs.categories), value: (template) => template.category },
        ]}
        sorts={[
          { id: "name", label: "Nombre", value: (template) => template.name },
          { id: "updated", label: "Última edición", type: "date", value: (template) => template.updated_at },
        ]}
        toolbarEnd={<TemplateForm overview={overview} />}
        emptyTitle="Aún no hay plantillas"
        columns={[
          {
            id: "name",
            header: "Plantilla",
            mobile: "title",
            cell: (template) => (
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-mono text-[13px] font-semibold">
                  <MessageCircle size={14} className="text-ok" />
                  {template.name}
                </p>
                <p className="truncate text-[12px] text-fg-3" title={template.body}>
                  {template.body}
                </p>
              </div>
            ),
          },
          { id: "purpose", header: "Uso", cell: (template) => <span className="text-[13px]">{template.purpose_label}</span> },
          { id: "category", header: "Categoría", cell: (template) => <span className="text-[13px] text-fg-2">{template.category_label} · {template.lang.toUpperCase()}</span> },
          {
            id: "variables",
            header: "Variables",
            wideOnly: true,
            cell: (template) => (
              <div className="flex flex-wrap gap-1">
                {template.variables.map((name) => (
                  <span key={name} className="rounded-md bg-surface-2 px-1.5 font-mono text-[11px] text-fg-2">{`{{${name}}}`}</span>
                ))}
              </div>
            ),
          },
          {
            id: "status",
            header: "Estado",
            cell: (template) => (
              <div>
                <StatusPill status={template.status} label={template.status_label} />
                {template.rejected_reason && <p className="mt-1 max-w-[220px] truncate text-[11.5px] text-bad" title={template.rejected_reason}>{template.rejected_reason}</p>}
              </div>
            ),
          },
          { id: "updated", header: "Última edición", wideOnly: true, cell: (template) => <span className="text-[12.5px] text-fg-3">{formatDateTime(template.updated_at)}{template.updated_by ? ` · ${template.updated_by}` : ""}</span> },
          {
            id: "actions",
            header: "",
            align: "right",
            cell: (template) => (
              <RowActions>
                <ToggleAction template={template} />
                <ReviewAction template={template} />
                <TemplateForm overview={overview} template={template} />
              </RowActions>
            ),
          },
        ]}
      />
    </>
  );
}
