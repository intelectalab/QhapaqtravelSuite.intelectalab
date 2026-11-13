"use client";

import { Ban, CalendarClock, Copy, FileText, FlaskConical, Megaphone, Plus, SendHorizontal, Ticket, Undo2, Users } from "lucide-react";
import { useRef, useState } from "react";
import { campaignStep, saveCampaign } from "@/app/(backoffice)/marketing/campanas/actions";
import { RowIcon } from "@/components/table/RowActions";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { formatDate, formatDateTime, formatMoney, formatPercent } from "@/lib/format";
import { rate, SAMPLE_VARIABLES, suppressedOf, type Campaign, type MarketingOverview } from "@/lib/marketing";
import type { StepResult } from "@/lib/server/resource";
import { Preview, rulesHint } from "./TemplateForms";

const initial: StepResult = { message: null, done: false };

export function CampaignFormAction({ overview, campaign, segmentCode, trigger }: { overview: MarketingOverview; campaign?: Campaign; segmentCode?: string; trigger?: (open: () => void) => React.ReactNode }) {
  const [channel, setChannel] = useState<"email" | "whatsapp">(campaign?.channel ?? "email");
  const [templateCode, setTemplateCode] = useState(campaign?.template?.code ?? "");
  const [subject, setSubject] = useState(campaign?.subject ?? "");
  const [body, setBody] = useState(campaign?.body ?? "");
  const [segment, setSegment] = useState(campaign?.segment?.code ?? segmentCode ?? "");
  const [sample, setSample] = useState(overview.test_options?.samples[0]?.value ?? "");
  const activeCodes = overview.codes.filter((code) => code.status === "activa");
  const knownPromo = !campaign?.promo_code || activeCodes.some((code) => code.code === campaign.promo_code);
  const [customPromo, setCustomPromo] = useState(!knownPromo || activeCodes.length === 0);
  const [promo, setPromo] = useState(campaign?.promo_code ?? "");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const templates = overview.templates.filter((template) => template.channel === channel);
  const editable = !campaign || campaign.status === "borrador";
  const chosen = overview.segments.find((item) => item.code === segment);
  const reachable = chosen ? (channel === "email" ? chosen.email : chosen.whatsapp) : null;
  const sampleName = overview.test_options?.samples.find((item) => item.value === sample)?.label;
  const values = { ...SAMPLE_VARIABLES, ...(sampleName ? { nombre: sampleName.split(" ")[0] } : {}), ...(promo ? { codigo_promo: promo } : {}) };

  const insert = (name: string) => {
    const token = `{{${name}}}`;
    const field = bodyRef.current;
    if (!field || channel === "whatsapp") return setBody((current) => current + token);
    const start = field.selectionStart ?? body.length;
    const end = field.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + token + body.slice(end));
    window.requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + token.length, start + token.length);
    });
  };

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
      formId={campaign ? `campana-${campaign.code}` : segmentCode ? `nueva-campana-${segmentCode}` : "nueva-campana"}
      title={campaign ? "Editar campaña" : "Nueva campaña"}
      description={campaign ? `${campaign.code} · editar invalida las pruebas enviadas.` : "Se crea en borrador. Antes de programarla envía una prueba."}
      submitLabel={campaign ? "Guardar cambios" : "Crear borrador"}
      action={saveCampaign}
      initial={initial}
      trigger={campaign ? (open) => <RowIcon tone="edit" label="Editar campaña" onClick={open} disabledHint={editable ? undefined : "Solo se editan campañas en borrador"} /> : trigger}
    >
      {() => (
        <>
          {campaign && <input type="hidden" name="code" value={campaign.code} />}
          <input type="hidden" name="promo_code" value={promo} />
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
          <SelectField label="Segmento" name="segment" options={overview.segments.map((item) => ({ value: item.code, label: item.name, hint: `${channel === "email" ? item.email : item.whatsapp} contactables` }))} value={segment} onChange={setSegment} placeholder="Elegir segmento" />
          {chosen && reachable !== null && (
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Coinciden" value={String(chosen.matched)} />
              <Metric label={`Por ${channel === "email" ? "email" : "WhatsApp"}`} value={String(reachable)} note="Con consentimiento" />
              <Metric label="Quedan fuera" value={String(Math.max(0, chosen.matched - reachable))} note="Sin dato o sin permiso" />
            </div>
          )}
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
          <div>
            <TextArea ref={bodyRef} label="Mensaje" name="body" rows={7} value={body} onChange={(event) => setBody(event.target.value)} readOnly={channel === "whatsapp"} maxLength={5000} />
            {channel === "email" && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {overview.variables.map((name) => (
                  <button key={name} type="button" onClick={() => insert(name)} className="rounded-md border border-line bg-surface-2 px-2 py-0.5 font-mono text-[11.5px] text-fg-2 transition hover:-translate-y-0.5 hover:border-accent/50 hover:text-accent">
                    {`{{${name}}}`}
                  </button>
                ))}
                {rulesHint(channel, "MARKETING", body)}
              </div>
            )}
          </div>
          {customPromo ? (
            <TextField label="Código promocional (opcional)" value={promo} onChange={(event) => setPromo(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))} maxLength={20} icon={<Ticket size={17} />} placeholder="PRIMAVERA8" hint={activeCodes.length > 0 ? "Debe existir como promoción activa del catálogo antes del envío." : "Aún no hay promociones activas con código en el catálogo."} />
          ) : (
            <SelectField label="Código promocional (opcional)" name="promo_picker" options={activeCodes.map((code) => ({ value: code.code, label: code.code, hint: [code.product, code.valid_to ? `hasta ${formatDate(code.valid_to)}` : null].filter(Boolean).join(" · ") }))} value={promo} onChange={setPromo} placeholder="Sin código" />
          )}
          {activeCodes.length > 0 && (
            <button type="button" onClick={() => setCustomPromo(!customPromo)} className="-mt-2 self-start text-[12.5px] font-semibold text-accent hover:underline">
              {customPromo ? "Elegir de las promociones activas" : "Escribir otro código"}
            </button>
          )}
          <div>
            <div className="mb-1.5 flex items-end justify-between gap-2">
              <p className="text-[13px] font-semibold">Vista previa</p>
              {(overview.test_options?.samples.length ?? 0) > 0 && <SelectField className="w-[210px]" label="Con el contacto" name="preview_sample" options={overview.test_options?.samples ?? []} value={sample} onChange={setSample} />}
            </div>
            <Preview channel={channel} subject={subject} body={body} values={values} />
          </div>
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
          <input type="hidden" name="lock_version" value={campaign.lock_version} />
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

export function CampaignDetailAction({ campaign, canManage, testOptions }: { campaign: Campaign; canManage: boolean; testOptions?: MarketingOverview["test_options"] }) {
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
          <>
            <Button type="submit" form={formId} name="intent" value="test" variant="secondary" icon={<FlaskConical size={15} />} disabled={pending}>
              Enviar prueba
            </Button>
            <Button type="submit" form={formId} name="intent" value="send" variant="secondary" icon={<SendHorizontal size={15} />} disabled={pending || campaign.tests.length === 0} title={campaign.tests.length === 0 ? "Primero envía una prueba con el contenido actual" : undefined}>
              Enviar ahora
            </Button>
          </>
        ) : null
      }
    >
      {() => (
        <>
          <input type="hidden" name="code" value={campaign.code} />
          <input type="hidden" name="lock_version" value={campaign.lock_version} />
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
                <Metric label="Suprimidos" value={String(suppressedOf(campaign.audience))} note={campaign.audience.fatigue ? `Incluye ${campaign.audience.fatigue} por otra campaña en 72 h` : "Baja, sin dato o sin permiso"} />
              </div>
            )
          )}
          {campaign.subject && <p className="text-[13px]"><b>Asunto:</b> {campaign.subject}</p>}
          <p className="whitespace-pre-line rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-[13px] leading-relaxed">{campaign.body}</p>
          {campaign.tests.length > 0 && <p className="text-[12.5px] text-fg-3">Última prueba: {campaign.tests[campaign.tests.length - 1].to} · {formatDateTime(campaign.tests[campaign.tests.length - 1].at)}</p>}
          {campaign.cancel_reason && <p className="text-[13px] text-fg-2"><b>Cancelada:</b> {campaign.cancel_reason}</p>}
          {canManage && (draft || scheduled) && testOptions && (
            <fieldset className="grid gap-3 rounded-xl border border-line p-3 sm:grid-cols-2">
              <legend className="px-1 text-[12.5px] font-semibold text-fg-3">Envío de prueba</legend>
              <SelectField
                label="Destinatario interno"
                name="to_user_id"
                options={testOptions.recipients.map((user) => ({ value: user.value, label: user.label, hint: (campaign.channel === "email" ? user.email : user.phone) ?? "Sin teléfono" }))}
                defaultValue={testOptions.me}
              />
              <SelectField label="Datos de ejemplo" name="sample" options={testOptions.samples} placeholder="Sin contacto de ejemplo" clearable />
            </fieldset>
          )}
          {canManage && draft && <TextField label="Enviar el" name="scheduled_at" type="datetime-local" icon={<CalendarClock size={17} />} hint="Al menos 15 minutos después de ahora. WhatsApp solo entre 08:00 y 20:00." />}
          {canManage && scheduled && <p className="flex items-center gap-2 text-[12.5px] text-fg-3"><Undo2 size={14} /> Desprogramar la devuelve a borrador para editarla.</p>}
          {canManage && (draft || scheduled) && <p className="flex items-center gap-2 text-[12.5px] text-fg-3"><SendHorizontal size={14} /> Enviar ahora recalcula la audiencia, excluye bajas y a quien recibió otra campaña en 72 h, y despacha el envío por lotes.</p>}
          {campaign.status === "enviando" && <p className="rounded-xl bg-[color-mix(in_srgb,var(--sun)_12%,var(--surface))] px-3.5 py-2.5 text-[12.5px] text-fg-2">El envío está en curso por lotes. Antes de cada mensaje se vuelve a comprobar el consentimiento y la baja.</p>}
        </>
      )}
    </PanelAction>
  );
}

export function CampaignDuplicateAction({ campaign }: { campaign: Campaign }) {
  return (
    <PanelAction<StepResult>
      label="Duplicar"
      formId={`duplicar-${campaign.code}`}
      title="Duplicar campaña"
      description={`Crea «${campaign.name} (copia)» en borrador con el mismo segmento, plantilla y contenido, sin pruebas ni destinatarios.`}
      submitLabel="Duplicar"
      action={campaignStep}
      initial={initial}
      trigger={(open) => <RowIcon tone="neutral" label="Duplicar campaña" icon={<Copy size={15} />} onClick={open} />}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={campaign.code} />
          <input type="hidden" name="step" value="duplicate" />
          <ul className="flex flex-wrap gap-1.5 text-[12.5px]">
            {[
              { icon: Users, text: campaign.segment?.name ?? "Sin segmento" },
              { icon: FileText, text: campaign.template?.name ?? "Sin plantilla" },
              ...(campaign.promo_code ? [{ icon: Ticket, text: campaign.promo_code }] : []),
            ].map((pill) => (
              <li key={pill.text} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1">
                <pill.icon size={13} className="text-[var(--tint,var(--t1))]" />
                {pill.text}
              </li>
            ))}
          </ul>
        </>
      )}
    </PanelAction>
  );
}
