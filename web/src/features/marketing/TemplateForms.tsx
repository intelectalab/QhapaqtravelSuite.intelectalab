"use client";

import { BadgeCheck, FileText, Mail, MessageCircle, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { saveTemplate, templateReview } from "@/app/(backoffice)/marketing/campanas/actions";
import { RowIcon } from "@/components/table/RowActions";
import { Badge } from "@/components/ui/Badge";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { fillVariables, TEMPLATE_CATEGORIES, TEMPLATE_STATUS, type MarketingTemplate, type TemplateCategory } from "@/lib/marketing";
import type { StepResult } from "@/lib/server/resource";

const initial: StepResult = { message: null, done: false };

function Preview({ channel, subject, body }: { channel: "email" | "whatsapp"; subject: string; body: string }) {
  if (channel === "whatsapp") {
    return (
      <div className="rounded-xl bg-[color-mix(in_srgb,var(--ok)_8%,var(--surface))] p-3">
        <p className="w-fit max-w-full whitespace-pre-line rounded-xl rounded-tl-sm bg-surface px-3 py-2 text-[13px] leading-relaxed shadow-sm">{fillVariables(body) || "El mensaje aparece aquí."}</p>
        <p className="mt-1.5 text-[11px] text-fg-3">WhatsApp Business · plantilla de Meta</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <p className="border-b border-line bg-surface-2 px-3 py-2 text-[12.5px]">
        <b>Asunto:</b> {fillVariables(subject) || "Sin asunto"}
      </p>
      <p className="whitespace-pre-line px-3 py-2.5 text-[13px] leading-relaxed">{fillVariables(body) || "El correo aparece aquí."}</p>
    </div>
  );
}

function rulesHint(channel: "email" | "whatsapp", category: TemplateCategory, body: string) {
  if (category !== "MARKETING") return null;
  const ok = channel === "email" ? body.includes("{{enlace_baja}}") : body.toUpperCase().includes("BAJA");
  return (
    <Badge tone={ok ? "ok" : "sun"} dot={false}>
      {channel === "email" ? (ok ? "Incluye el enlace de baja" : "Falta {{enlace_baja}}") : ok ? "Indica cómo darse de baja" : "Falta «Responde BAJA»"}
    </Badge>
  );
}

export function TemplateFormAction({ variables, template }: { variables: string[]; template?: MarketingTemplate }) {
  const [channel, setChannel] = useState<"email" | "whatsapp">(template?.channel ?? "email");
  const [category, setCategory] = useState<TemplateCategory>(template?.category ?? "MARKETING");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const reReview = template?.channel === "whatsapp" && template.status !== "en_revision";

  const insert = (name: string) => {
    const token = `{{${name}}}`;
    const field = bodyRef.current;
    if (!field) return setBody((current) => current + token);
    const start = field.selectionStart ?? body.length;
    const end = field.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    window.requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + token.length, start + token.length);
    });
  };

  return (
    <PanelAction<StepResult>
      label="Nueva plantilla"
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      formId={template ? `plantilla-${template.code}` : "nueva-plantilla"}
      title={template ? "Editar plantilla" : "Nueva plantilla"}
      description={template ? `${template.code}${template.provider_template_id ? ` · ID Meta ${template.provider_template_id}` : ""}` : "Las plantillas de WhatsApp pasan por la revisión de Meta antes de usarse."}
      submitLabel={template ? "Guardar cambios" : channel === "whatsapp" ? "Enviar a revisión" : "Crear plantilla"}
      action={saveTemplate}
      initial={initial}
      testId={template ? undefined : "template-create"}
      trigger={template ? (open) => <RowIcon tone="edit" label="Editar plantilla" onClick={open} /> : undefined}
    >
      {() => (
        <>
          {template && <input type="hidden" name="code" value={template.code} />}
          {template && <input type="hidden" name="lock_version" value={template.lock_version} />}
          {template ? (
            <p className="flex items-center gap-2 text-[13px] text-fg-2">
              {template.channel === "email" ? <Mail size={15} /> : <MessageCircle size={15} />}
              {template.channel === "email" ? "Email" : "WhatsApp"} · <Badge tone={TEMPLATE_STATUS[template.status].tone} dot={false}>{TEMPLATE_STATUS[template.status].label}</Badge>
            </p>
          ) : (
            <ChoiceGroup label="Canal" name="channel" options={[{ value: "email", label: "Email" }, { value: "whatsapp", label: "WhatsApp" }]} defaultValue={channel} onChange={(value) => setChannel(value as "email" | "whatsapp")} />
          )}
          <TextField label="Nombre" name="name" required minLength={3} maxLength={120} defaultValue={template?.name} icon={<FileText size={17} />} hint={channel === "whatsapp" ? "Minúsculas, números y guion bajo, como en Meta: promo_verano_2027" : undefined} />
          <SelectField label="Categoría" name="category" options={TEMPLATE_CATEGORIES} value={category} onChange={(value) => setCategory(value as TemplateCategory)} hint={category === "MARKETING" ? "Comercial: solo se envía a quien dio su consentimiento." : "Servicio o utilidad: se basa en el contrato de viaje y respeta las bajas."} />
          {channel === "email" && <TextField label="Asunto" name="subject" required maxLength={200} value={subject} onChange={(event) => setSubject(event.target.value)} />}
          <div>
            <TextArea ref={bodyRef} label="Mensaje" name="body" rows={7} required minLength={10} maxLength={5000} value={body} onChange={(event) => setBody(event.target.value)} />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {variables.map((name) => (
                <button key={name} type="button" onClick={() => insert(name)} className="rounded-md border border-line bg-surface-2 px-2 py-0.5 font-mono text-[11.5px] text-fg-2 transition hover:-translate-y-0.5 hover:border-accent/50 hover:text-accent">
                  {`{{${name}}}`}
                </button>
              ))}
              {rulesHint(channel, category, body)}
            </div>
          </div>
          {reReview && <p className="rounded-xl bg-[color-mix(in_srgb,var(--sun)_12%,var(--surface))] px-3.5 py-2.5 text-[12.5px] text-fg-2">Si cambias el nombre, la categoría o el texto, vuelve a revisión de Meta y no se podrá usar hasta su aprobación.</p>}
          <div>
            <p className="mb-1.5 text-[13px] font-semibold">Vista previa con un contacto de ejemplo</p>
            <Preview channel={channel} subject={subject} body={body} />
          </div>
        </>
      )}
    </PanelAction>
  );
}

export function TemplateReviewAction({ template }: { template: MarketingTemplate }) {
  const pending = template.channel === "whatsapp" && template.status === "en_revision";
  return (
    <PanelAction<StepResult>
      label="Respuesta de Meta"
      formId={`revision-${template.code}`}
      title="Registrar respuesta de Meta"
      description={`${template.name}${template.provider_template_id ? ` · ID Meta ${template.provider_template_id}` : ""}`}
      submitLabel="Registrar respuesta"
      action={templateReview}
      initial={initial}
      trigger={(open) => <RowIcon tone="neutral" label="Registrar respuesta de Meta" icon={<BadgeCheck size={15} />} onClick={open} disabledHint={pending ? undefined : "Solo plantillas de WhatsApp en revisión"} />}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={template.code} />
          <input type="hidden" name="lock_version" value={template.lock_version} />
          <ChoiceGroup label="Meta respondió" name="meta_status" options={[{ value: "aprobada", label: "Aprobada" }, { value: "rechazada", label: "Rechazada" }]} defaultValue="aprobada" />
          <p className="text-[12.5px] text-fg-3">Mientras no haya cuenta de WhatsApp Business conectada, la revisión la simula el adaptador de pruebas. Con la cuenta real, la respuesta llega sola.</p>
          <p className="whitespace-pre-line rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-[13px] leading-relaxed">{template.body}</p>
        </>
      )}
    </PanelAction>
  );
}
