"use client";

import { Copy, Mail, MessageCircle, Plus, Users } from "lucide-react";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { previewSegment, saveSegment, segmentStep } from "@/app/(backoffice)/marketing/campanas/actions";
import { RowIcon } from "@/components/table/RowActions";
import { Badge } from "@/components/ui/Badge";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { RowsEditor } from "@/components/ui/RowsEditor";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { formatNumber } from "@/lib/format";
import { suppressedOf, type CampaignAudience, type Segment, type SegmentField, type SegmentPreview, type SegmentRule } from "@/lib/marketing";
import type { StepResult } from "@/lib/server/resource";
import { toneStyle, type Tone } from "@/lib/tone";

const initial: StepResult = { message: null, done: false };

const SUPPRESSIONS: { key: keyof CampaignAudience; label: string }[] = [
  { key: "optout", label: "Con baja" },
  { key: "nodata", label: "Sin dato" },
  { key: "consent", label: "Sin permiso" },
];

function blankRule(fields: SegmentField[]): SegmentRule {
  const field = fields[0];
  return { f: field?.field ?? "type", op: field?.ops[0]?.value ?? "eq", v: field?.values[0]?.value ?? "" };
}

function RuleRow({ rule, fields, update }: { rule: SegmentRule; fields: SegmentField[]; update: (patch: Partial<SegmentRule>) => void }) {
  const field = fields.find((item) => item.field === rule.f) ?? fields[0];
  const operator = field?.ops.find((item) => item.value === rule.op) ?? field?.ops[0];
  return (
    <div className="grid gap-2.5 sm:grid-cols-3">
      <SelectField
        label="Campo"
        name="rule_field"
        options={fields.map((item) => ({ value: item.field, label: item.label }))}
        value={rule.f}
        onChange={(value) => {
          const next = fields.find((item) => item.field === value);
          update({ f: value, op: next?.ops[0]?.value ?? "eq", v: next?.values[0]?.value ?? "" });
        }}
      />
      <SelectField label="Condición" name="rule_op" options={(field?.ops ?? []).map((item) => ({ value: item.value, label: item.label }))} value={rule.op} onChange={(value) => update({ op: value })} />
      {operator?.needs_value === false ? (
        <div className="flex items-end pb-2 text-[12.5px] text-fg-3">Sin valor que indicar</div>
      ) : field && field.kind === "choice" && field.values.length > 0 ? (
        <SelectField label="Valor" name="rule_value" options={field.values} value={String(rule.v ?? "")} onChange={(value) => update({ v: value })} searchable={field.values.length > 8} />
      ) : (
        <TextField label="Valor" name="rule_value" type={field?.kind === "number" ? "number" : "text"} min={field?.kind === "number" ? 0 : undefined} value={String(rule.v ?? "")} onChange={(event) => update({ v: event.target.value })} />
      )}
    </div>
  );
}

function ChannelAudience({ label, icon, tone, audience }: { label: string; icon: ReactNode; tone: Tone; audience: CampaignAudience }) {
  const share = audience.matched > 0 ? (audience.eligible / audience.matched) * 100 : 0;
  return (
    <div style={toneStyle(tone)} className="lift rounded-xl border border-line bg-surface px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--tint)]">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 text-[18px] font-bold">{formatNumber(audience.eligible)}</p>
      <div className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-surface-2">
        <span style={{ width: `${share}%` }} className="h-full origin-left bg-[var(--tint)] motion-safe:animate-[fill-x_520ms_cubic-bezier(0.4,0,0.2,1)_backwards]" />
      </div>
      <p className="mt-1.5 text-[11.5px] text-fg-3">{SUPPRESSIONS.map((item) => `${item.label} ${audience[item.key] ?? 0}`).join(" · ")}</p>
    </div>
  );
}

function LivePreview({ match, rules }: { match: string; rules: SegmentRule[] }) {
  const [preview, setPreview] = useState<SegmentPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, start] = useTransition();

  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      start(async () => {
        const result = await previewSegment(match, rules);
        if (!live) return;
        setPreview(result.data);
        setMessage(result.message);
      });
    }, 300);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [match, rules]);

  if (message) return <p className="rounded-xl border border-dashed border-[color-mix(in_srgb,var(--bad)_50%,transparent)] px-3.5 py-3 text-[12.5px] text-bad">{message}</p>;
  if (!preview) return <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[12.5px] text-fg-3">Calculando audiencia…</p>;

  return (
    <section aria-live="polite" className={loading ? "opacity-60 transition-opacity" : "transition-opacity"}>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-semibold">Audiencia en vivo</p>
        <p className="text-[12px] text-fg-3">{preview.rules_text}</p>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-surface-2 px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-fg-2">
            <Users size={13} />
            Coinciden
          </p>
          <p className="mt-0.5 text-[18px] font-bold">{formatNumber(preview.matched)}</p>
          <p className="mt-1.5 text-[11.5px] text-fg-3">{preview.by_type.filter((item) => item.count > 0).map((item) => `${item.label} ${item.count}`).join(" · ") || "Ningún contacto"}</p>
        </div>
        <ChannelAudience label="Email" icon={<Mail size={13} />} tone="info" audience={preview.email} />
        <ChannelAudience label="WhatsApp" icon={<MessageCircle size={13} />} tone="ok" audience={preview.whatsapp} />
      </div>
      {preview.sample.length > 0 && (
        <ul className="mt-2.5 divide-y divide-line overflow-hidden rounded-xl border border-line">
          {preview.sample.map((contact) => (
            <li key={contact.key} className="flex items-center justify-between gap-3 px-3 py-2 text-[12.5px]">
              <span className="min-w-0">
                <b className="block truncate">{contact.name}</b>
                <span className="text-fg-3">{contact.type_label} · {contact.email ?? contact.mobile ?? "Sin dato de contacto"}</span>
              </span>
              <span className="flex flex-none gap-1">
                <Badge tone={contact.revoked.email ? "bad" : contact.consent.email ? "info" : "mute"} dot={false}>Email</Badge>
                <Badge tone={contact.revoked.whatsapp ? "bad" : contact.consent.whatsapp ? "ok" : "mute"} dot={false}>WhatsApp</Badge>
              </span>
            </li>
          ))}
        </ul>
      )}
      {preview.matched > preview.sample.length && <p className="mt-1.5 text-[11.5px] text-fg-3">Se muestran 10 de {formatNumber(preview.matched)} contactos. Total suprimidos por email: {suppressedOf(preview.email)}.</p>}
    </section>
  );
}

export function SegmentFormAction({ fields, segment }: { fields: SegmentField[]; segment?: Segment }) {
  const [match, setMatch] = useState<string>(segment?.match ?? "all");
  const [rules, setRules] = useState<SegmentRule[]>(segment?.rules ?? [blankRule(fields)]);
  return (
    <PanelAction<StepResult>
      label="Nuevo segmento"
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      formId={segment ? `segmento-${segment.code}` : "nuevo-segmento"}
      title={segment ? "Editar segmento" : "Nuevo segmento"}
      description={segment ? `${segment.code} · se evalúa de nuevo en cada envío.` : "Las reglas se evalúan en cada envío: quien se da de baja sale solo."}
      submitLabel={segment ? "Guardar cambios" : "Crear segmento"}
      action={saveSegment}
      initial={initial}
      testId={segment ? undefined : "segment-create"}
      trigger={segment ? (open) => <RowIcon tone="edit" label="Editar segmento" onClick={open} /> : undefined}
    >
      {() => (
        <>
          {segment && <input type="hidden" name="code" value={segment.code} />}
          {segment && <input type="hidden" name="lock_version" value={segment.lock_version} />}
          <input type="hidden" name="rules" value={JSON.stringify(rules)} />
          <TextField label="Nombre" name="name" required minLength={4} maxLength={160} defaultValue={segment?.name} icon={<Users size={17} />} />
          <TextArea label="Descripción (opcional)" name="description" rows={2} maxLength={500} defaultValue={segment?.description ?? undefined} />
          <ChoiceGroup
            label="Coincidencia"
            name="match"
            options={[
              { value: "all", label: "Todas las reglas" },
              { value: "any", label: "Alguna regla" },
            ]}
            defaultValue={match}
            onChange={setMatch}
          />
          <RowsEditor rows={rules} onChange={setRules} create={() => blankRule(fields)} itemLabel="Regla" addLabel="Agregar regla" empty="Sin reglas: incluye a todos los contactos." max={12} reorder={false} render={(rule, update) => <RuleRow rule={rule} fields={fields} update={update} />} />
          <LivePreview match={match} rules={rules} />
        </>
      )}
    </PanelAction>
  );
}

export function SegmentDuplicateAction({ segment }: { segment: Segment }) {
  return (
    <PanelAction<StepResult>
      label="Duplicar"
      formId={`duplicar-${segment.code}`}
      title="Duplicar segmento"
      description={`Crea «${segment.name} (copia)» con las mismas reglas para ajustarlas sin tocar el original.`}
      submitLabel="Duplicar"
      action={segmentStep}
      initial={initial}
      trigger={(open) => <RowIcon tone="neutral" label="Duplicar segmento" icon={<Copy size={15} />} onClick={open} />}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={segment.code} />
          <input type="hidden" name="step" value="duplicate" />
          <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[13px] text-fg-2">{segment.rules_text}</p>
        </>
      )}
    </PanelAction>
  );
}

export function SegmentDeleteAction({ segment }: { segment: Segment }) {
  const used = segment.campaigns > 0;
  return (
    <PanelAction<StepResult>
      label="Eliminar"
      formId={`eliminar-${segment.code}`}
      title="Eliminar segmento"
      description={`${segment.name}. Deja de aparecer al crear campañas.`}
      submitLabel="Eliminar segmento"
      action={segmentStep}
      initial={initial}
      trigger={(open) => <RowIcon tone="delete" label="Eliminar segmento" onClick={open} disabledHint={used ? "Lo usan campañas: se conserva como evidencia. Puedes duplicarlo." : undefined} />}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={segment.code} />
          <input type="hidden" name="lock_version" value={segment.lock_version} />
          <input type="hidden" name="step" value="delete" />
          <p className="text-[13px] text-fg-2">Queda registrado en la auditoría. Las campañas futuras no podrán usarlo.</p>
        </>
      )}
    </PanelAction>
  );
}
