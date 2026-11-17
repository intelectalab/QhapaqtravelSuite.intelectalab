"use client";

import { AlertTriangle, BookOpen, ExternalLink, KeyRound, Newspaper, ShieldAlert, ShieldX } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { generatePayloadSecret, savePayloadAdminUrl } from "@/app/plataforma/(consola)/integraciones/blog-de-la-vitrina/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { InfoTip } from "@/components/ui/InfoTip";
import { PanelAction } from "@/components/ui/PanelAction";
import { TextField } from "@/components/ui/TextField";
import { TintCardTitle } from "@/components/ui/Tinted";
import { SecretReveal } from "@/features/admin/AdminParts";
import { EditSection, SectionCard } from "@/features/admin/Settings";
import { ADMIN_INITIAL, type AdminActionState } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import type { PayloadWebhookSummary } from "@/lib/platform";
import { toneStyle } from "@/lib/tone";

const EVENTS: Record<string, string> = { created: "Creado", updated: "Actualizado", published: "Publicado", unpublished: "Despublicado", slug_changed: "Cambio de slug", deleted: "Eliminado" };

function GenerateSecret({ payload, onSecret }: { payload: PayloadWebhookSummary; onSecret: (secret: string, rotated: boolean) => void }) {
  const rotate = payload.secret_set;
  return (
    <PanelAction<AdminActionState>
      label={rotate ? "Rotar clave" : "Generar clave"}
      formId="payload-secret"
      title={rotate ? "Rotar la clave de firma" : "Generar la clave de firma"}
      description={rotate ? "Se crea una clave nueva y la verás una sola vez. La anterior sigue valiendo 24 horas para que la cambies en Payload sin perder avisos." : "Se crea la clave con la que Payload firma cada aviso. La verás una sola vez para copiarla en Payload."}
      submitLabel={rotate ? "Rotar clave" : "Generar clave"}
      action={generatePayloadSecret}
      initial={ADMIN_INITIAL}
      successToast={false}
      onDone={(state) => state.secret && onSecret(state.secret, state.label === "rotada")}
      trigger={(open) => (
        <Button variant={rotate ? "secondary" : "primary"} size="sm" icon={<KeyRound size={15} />} onClick={open}>
          {rotate ? "Rotar clave" : "Generar clave"}
        </Button>
      )}
    >
      {() => <p className="text-[13px] text-fg-2">En Payload, pega la clave en la variable KIPU_WEBHOOK_SECRET y reinicia el CMS.</p>}
    </PanelAction>
  );
}

function StatusTile({ icon: Icon, tone, label, value, note }: { icon: typeof BookOpen; tone: "ok" | "warn" | "bad" | "mute"; label: string; value: string; note?: string }) {
  return (
    <div style={toneStyle(tone)} className="lift group rounded-xl border border-[color-mix(in_srgb,var(--tint)_24%,transparent)] bg-[color-mix(in_srgb,var(--tint)_6%,var(--surface))] p-3">
      <span className="flex items-center gap-2 text-[12px] font-semibold text-fg-3">
        <span className="grid size-7 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--tint)_14%,transparent)] text-[var(--tint)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
          <Icon size={14} />
        </span>
        {label}
      </span>
      <b className="mt-2 block text-[14px] font-semibold">{value}</b>
      {note && <span className="block text-[12px] text-fg-2">{note}</span>}
    </div>
  );
}

export function PayloadBlogCard({ payload }: { payload: PayloadWebhookSummary }) {
  const [secret, setSecret] = useState<{ value: string; rotated: boolean } | null>(null);
  const last = payload.last_signed;

  return (
    <>
      {secret && <SecretReveal secret={secret.value} title={secret.rotated ? "Nueva clave de firma de Payload" : "Clave de firma de Payload"} onClose={() => setSecret(null)} />}
      {payload.still_previous && (
        <div style={toneStyle("warn")} className="mb-5 flex items-start gap-3 rounded-card border border-[color-mix(in_srgb,var(--tint)_35%,transparent)] bg-[color-mix(in_srgb,var(--tint)_8%,var(--surface))] p-4">
          <AlertTriangle size={18} className="mt-0.5 flex-none text-[var(--tint)]" />
          <div className="min-w-0">
            <p className="text-[14px] font-semibold">Payload todavía firma con la clave anterior</p>
            <p className="text-[12.5px] text-fg-2">
              {payload.previous_secret_valid && payload.previous_secret_until ? `La anterior sigue valiendo hasta el ${formatDateTime(payload.previous_secret_until)}. ` : "La clave anterior ya no vale y los avisos firmados con ella se rechazan. "}
              Copia la clave nueva en Payload. El aviso desaparece con el primer artículo firmado con ella.
            </p>
          </div>
        </div>
      )}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <SectionCard
          index={0}
          icon={BookOpen}
          tone="info"
          title="Payload de la vitrina"
          updated={payload.changed_at}
          action={
            <EditSection section="payload_admin" version={0} action={savePayloadAdminUrl} title="Payload de la vitrina" description="La dirección del panel de Payload donde el equipo escribe y publica los artículos del blog de Rutas Libres.">
              <TextField label="URL del admin de Payload" name="admin_url" type="url" required maxLength={300} defaultValue={payload.admin_url} spellCheck={false} placeholder="https://rutaslibres.pe/admin" />
            </EditSection>
          }
        >
          <FieldList
            fields={[
              { label: "Estado", value: <Badge tone={payload.secret_set ? "ok" : "mute"}>{payload.secret_set ? "Lista" : "Sin clave"}</Badge> },
              {
                label: "Admin de Payload",
                value: payload.admin_url ? (
                  <a href={payload.admin_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 break-all font-mono text-[12.5px] text-accent hover:underline">
                    {payload.admin_url} <ExternalLink size={12} />
                  </a>
                ) : (
                  "—"
                ),
              },
              { label: "Clave de firma", value: payload.secret_set ? <span className="font-mono text-[12.5px]">{payload.secret_hint}</span> : "Sin generar" },
              ...(payload.secret_generated_at ? [{ label: "Generada el", value: formatDateTime(payload.secret_generated_at) }] : []),
              ...(payload.previous_secret_until ? [{ label: "Clave anterior", value: payload.previous_secret_valid ? `Sigue valiendo hasta el ${formatDateTime(payload.previous_secret_until)}` : `Venció el ${formatDateTime(payload.previous_secret_until)}` }] : []),
              { label: "URL de devolución", value: <span className="break-all font-mono text-[12.5px]">{payload.callback_url}</span> },
              { label: "Cabeceras de firma", value: <span className="font-mono text-[12.5px]">{`${payload.signature_header} · ${payload.timestamp_header}`}</span> },
            ]}
          />
          <div className="mt-3 flex justify-end">
            <GenerateSecret payload={payload} onSecret={(value, rotated) => setSecret({ value, rotated })} />
          </div>
        </SectionCard>
        <Card className="lift">
          <TintCardTitle icon={Newspaper} title="Avisos de Payload" tone="t2" aside={<InfoTip>Payload avisa al publicar, despublicar o cambiar el slug de un artículo. Cada aviso llega firmado con la clave de firma y una marca de tiempo de 5 minutos.</InfoTip>} />
          <div className="grid gap-3">
            <StatusTile
              icon={BookOpen}
              tone={last === null ? "mute" : last.key === "anterior" ? "warn" : "ok"}
              label="Último aviso firmado"
              value={last ? formatDateTime(last.at) : "Todavía no llega ninguno"}
              note={last ? `${EVENTS[last.event] ?? last.event} · ${last.title || `/blog/${last.slug}`}${last.key === "anterior" ? " · con la clave anterior" : ""}` : "Aparece aquí con el primer artículo que publique Payload."}
            />
            <StatusTile
              icon={payload.rejections_24h > 0 ? ShieldX : ShieldAlert}
              tone={payload.rejections_24h > 0 ? "bad" : "ok"}
              label="Rechazados por firma en 24 h"
              value={payload.rejections_24h === 0 ? "Ninguno" : `${payload.rejections_24h} ${payload.rejections_24h === 1 ? "aviso" : "avisos"}`}
              note={payload.last_rejection_at ? `Último el ${formatDateTime(payload.last_rejection_at)} · WEBHOOK_SIGNATURE` : "Firma inválida o vencida: se responde 401 WEBHOOK_SIGNATURE."}
            />
          </div>
          <Link href="/plataforma/marketing-vitrina/blog" className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-accent transition hover:translate-x-0.5 hover:underline">
            Ver los artículos sincronizados
          </Link>
        </Card>
      </div>
    </>
  );
}
