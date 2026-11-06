"use client";

import { Ban, CalendarClock, FlaskConical, Megaphone, Plus, Ticket, Undo2 } from "lucide-react";
import { useState } from "react";
import { campaignStep, saveCampaign } from "@/app/(backoffice)/marketing/campanas/actions";
import { RowIcon } from "@/components/table/RowActions";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { formatDateTime, formatMoney, formatPercent } from "@/lib/format";
import { rate, type Campaign, type MarketingOverview } from "@/lib/marketing";
import type { StepResult } from "@/lib/server/resource";

const initial: StepResult = { message: null, done: false };

export function CampaignFormAction({ overview, campaign }: { overview: MarketingOverview; campaign?: Campaign }) {
  const [channel, setChannel] = useState<"email" | "whatsapp">(campaign?.channel ?? "email");
  const [templateCode, setTemplateCode] = useState(campaign?.template?.code ?? "");
  const [subject, setSubject] = useState(campaign?.subject ?? "");
  const [body, setBody] = useState(campaign?.body ?? "");
  const templates = overview.templates.filter((template) => template.channel === channel);
  const editable = !campaign || campaign.status === "borrador";

  const pick = (code: string) => {
    setTemplateCode(code);
    const template = overview.templates.find((item) => item.code === code);
    if (template) {
      setSubject(template.subject ?? "");
      setBody(template.body);
    }
  };

  return (
    <PanelAction<StepResult>
      label="Nueva campaña"
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      formId={campaign ? `campana-${campaign.code}` : "nueva-campana"}
      title={campaign ? "Editar campaña" : "Nueva campaña"}
      description={campaign ? `${campaign.code} · editar invalida las pruebas enviadas.` : "Se crea en borrador. Antes de programarla envía una prueba."}
      submitLabel={campaign ? "Guardar cambios" : "Crear borrador"}
      action={saveCampaign}
      initial={initial}
      trigger={campaign ? (open) => <RowIcon tone="edit" label="Editar campaña" onClick={open} disabledHint={editable ? undefined : "Solo se editan campañas en borrador"} /> : undefined}
    >
      {() => (
        <>
          {campaign && <input type="hidden" name="code" value={campaign.code} />}
          <TextField label="Nombre" name="name" required minLength={4} maxLength={160} defaultValue={campaign?.name} icon={<Megaphone size={17} />} />
          <ChoiceGroup
            label="Canal"
            name="channel"
            options={[{ value: "email", label: "Email" }, { value: "whatsapp", label: "WhatsApp" }]}
            defaultValue={channel}
            onChange={(value) => {
              setChannel(value as "email" | "whatsapp");
              setTemplateCode("");
            }}
          />
          <SelectField label="Segmento" name="segment" options={overview.segments.map((segment) => ({ value: segment.code, label: segment.name, hint: `${channel === "email" ? segment.email : segment.whatsapp} contactables` }))} defaultValue={campaign?.segment?.code ?? ""} placeholder="Elegir segmento" />
          <SelectField
            key={channel}
            label="Plantilla"
            name="template"
            options={templates.filter((template) => template.usable || template.code === templateCode).map((template) => ({ value: template.code, label: template.name, hint: template.usable ? template.category : "En revisión por Meta" }))}
            defaultValue={templateCode}
            placeholder="Elegir plantilla"
            onChange={pick}
            hint={channel === "whatsapp" ? "WhatsApp solo admite plantillas aprobadas por Meta; el texto no se edita." : undefined}
          />
          {channel === "email" && <TextField label="Asunto" name="subject" required value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={200} />}
          <TextArea label="Mensaje" name="body" rows={7} value={body} onChange={(event) => setBody(event.target.value)} readOnly={channel === "whatsapp"} maxLength={5000} hint="Variables: {{nombre}}, {{destino}}, {{asesor}}, {{codigo_promo}}, {{agencia}}. El correo debe incluir {{enlace_baja}}." />
          <TextField label="Código promocional (opcional)" name="promo_code" defaultValue={campaign?.promo_code ?? undefined} maxLength={20} icon={<Ticket size={17} />} placeholder="PRIMAVERA8" />
        </>
      )}
    </PanelAction>
  );
}

export function CampaignCancelAction({ campaign }: { campaign: Campaign }) {
  const allowed = campaign.status === "borrador" || campaign.status === "programada";
  return (
    <PanelAction<StepResult>
      label="Cancelar"
      formId={`cancelar-${campaign.code}`}
      title="Cancelar campaña"
      description={`${campaign.name}. Queda en el historial como cancelada.`}
      submitLabel="Cancelar campaña"
      action={campaignStep}
      initial={initial}
      trigger={(open) => <RowIcon tone="delete" label="Cancelar campaña" icon={<Ban size={15} />} onClick={open} disabledHint={allowed ? undefined : "Las campañas enviadas no se cancelan"} />}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={campaign.code} />
          <input type="hidden" name="step" value="cancel" />
          <TextArea label="Motivo" name="reason" rows={2} required minLength={5} maxLength={500} />
        </>
      )}
    </PanelAction>
  );
}

function Metric({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-xl bg-surface-2 px-3 py-2.5 transition-transform duration-200 hover:-translate-y-0.5">
      <p className="text-[11.5px] text-fg-3">{label}</p>
      <p className="text-[16px] font-bold">{value}</p>
      {note && <p className="text-[11px] text-fg-3">{note}</p>}
    </div>
  );
}

export function CampaignDetailAction({ campaign, canManage }: { campaign: Campaign; canManage: boolean }) {
  const formId = `detalle-${campaign.code}`;
  const draft = campaign.status === "borrador";
  const scheduled = campaign.status === "programada";
  const { metrics } = campaign;
  return (
    <PanelAction<StepResult>
      label="Ver"
      formId={formId}
      title={campaign.name}
      description={`${campaign.code} · ${campaign.channel_label} · ${campaign.segment?.name ?? "sin segmento"}`}
      submitLabel={canManage && draft ? "Programar envío" : canManage && scheduled ? "Desprogramar" : "Listo"}
      action={campaignStep}
      initial={initial}
      trigger={(open) => <RowIcon tone="view" label="Ver campaña" onClick={open} />}
      footerExtra={(_state, pending) =>
        canManage && (draft || scheduled) ? (
          <Button type="submit" form={formId} name="intent" value="test" variant="secondary" icon={<FlaskConical size={15} />} disabled={pending}>
            Enviar prueba
          </Button>
        ) : null
      }
    >
      {() => (
        <>
          <input type="hidden" name="code" value={campaign.code} />
          <input type="hidden" name="step" value={draft ? "schedule" : scheduled ? "unschedule" : "view"} />
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={campaign.status} label={campaign.status_label} />
            {campaign.promo_code && <Badge tone="sun" dot={false}>Código {campaign.promo_code}</Badge>}
            {campaign.sent_at && <Badge tone="mute" dot={false}>Enviada {formatDateTime(campaign.sent_at)}</Badge>}
            {scheduled && campaign.scheduled_at && <Badge tone="info" dot={false}>Programada {formatDateTime(campaign.scheduled_at)}</Badge>}
          </div>
          {campaign.status === "enviada" ? (
            <>
              <div className="grid grid-cols-3 gap-2">
                <Metric label="Entregados" value={`${metrics.delivered} de ${metrics.recipients}`} />
                <Metric label="Apertura" value={formatPercent(rate(metrics.opened, metrics.delivered), 0)} note={`${metrics.opened} contactos`} />
                <Metric label="Clics" value={formatPercent(rate(metrics.clicked, metrics.delivered), 0)} note={`${metrics.clicked} contactos`} />
                <Metric label="Respuestas" value={String(metrics.replied)} />
                <Metric label="Bajas" value={String(metrics.unsubscribed)} />
                <Metric label="Ingresos atribuidos" value={formatMoney(campaign.attribution.revenue, "PEN", { compact: true })} note={`${campaign.attribution.reservations} reservas`} />
              </div>
              {campaign.attribution.items.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {campaign.attribution.items.map((item) => (
                    <li key={item.code} className="flex justify-between gap-3 rounded-lg border border-line px-3 py-2 text-[12.5px]">
                      <span className="truncate">{item.code} · {item.title}</span>
                      <b className="font-mono">{formatMoney(item.total_pen)}</b>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            campaign.audience && (
              <div className="grid grid-cols-3 gap-2">
                <Metric label="Coinciden" value={String(campaign.audience.matched)} />
                <Metric label="Elegibles" value={String(campaign.audience.eligible)} note="Con consentimiento" />
                <Metric label="Suprimidos" value={String(campaign.audience.optout + campaign.audience.nodata + campaign.audience.consent)} note="Baja, sin dato o sin permiso" />
              </div>
            )
          )}
          {campaign.subject && <p className="text-[13px]"><b>Asunto:</b> {campaign.subject}</p>}
          <p className="whitespace-pre-line rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-[13px] leading-relaxed">{campaign.body}</p>
          {campaign.tests.length > 0 && <p className="text-[12.5px] text-fg-3">Última prueba: {campaign.tests[campaign.tests.length - 1].to} · {formatDateTime(campaign.tests[campaign.tests.length - 1].at)}</p>}
          {campaign.cancel_reason && <p className="text-[13px] text-fg-2"><b>Cancelada:</b> {campaign.cancel_reason}</p>}
          {canManage && draft && <TextField label="Enviar el" name="scheduled_at" type="datetime-local" icon={<CalendarClock size={17} />} hint="Al menos 15 minutos después de ahora. WhatsApp solo entre 08:00 y 20:00." />}
          {canManage && scheduled && <p className="flex items-center gap-2 text-[12.5px] text-fg-3"><Undo2 size={14} /> Desprogramar la devuelve a borrador para editarla.</p>}
        </>
      )}
    </PanelAction>
  );
}
