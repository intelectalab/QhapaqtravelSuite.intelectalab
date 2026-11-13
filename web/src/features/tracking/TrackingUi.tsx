"use client";

import { BadgeCheck, CircleAlert, Clock3 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import { toneStyle } from "@/lib/tone";
import { CONSENT_LABEL, PROVIDER_TONE, TAG_STATUS, type TagStatus, type TrackingProvider, type TrackingTag } from "@/lib/tracking";

export const initialStep: StepResult = { message: null, done: false };

export function ProviderChip({ provider, label }: { provider: string; label: string }) {
  return (
    <span style={toneStyle(PROVIDER_TONE[provider] ?? "mute")} className="inline-flex min-w-[58px] items-center justify-center rounded-[7px] bg-[color-mix(in_srgb,var(--tint)_14%,transparent)] px-2 py-0.5 text-[11.5px] font-bold text-[var(--tint)] transition-transform duration-200 hover:scale-105">
      {label}
    </span>
  );
}

export function TagStatusBadge({ status, pending }: { status: TagStatus; pending?: boolean }) {
  const meta = TAG_STATUS[status];
  return (
    <span className="flex flex-col items-start gap-1">
      <Badge tone={meta.tone}>{meta.label}</Badge>
      {pending && <span className="text-[11.5px] font-semibold text-warn">Cambio por aprobar</span>}
    </span>
  );
}

export function VerifyCell({ tag }: { tag: TrackingTag }) {
  if (!tag.verified_at) return <span className="text-[12.5px] text-fg-3">Sin verificar</span>;
  const ok = tag.verify_result === "ok";
  const Icon = ok ? BadgeCheck : CircleAlert;
  return (
    <span className="flex flex-col" title={tag.verify_note ?? undefined}>
      <span className={cn("inline-flex items-center gap-1 text-[12.5px] font-semibold", ok ? "text-ok" : "text-bad")}>
        <Icon size={14} /> {ok ? "Carga bien" : "No cargó"}
      </span>
      <span className="text-[11.5px] text-fg-3">{formatDateTime(tag.verified_at)}</span>
    </span>
  );
}

export function FormSwitch({ name, label, hint, defaultChecked = false, disabled = false }: { name: string; label: string; hint?: string; defaultChecked?: boolean; disabled?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);
  return <SwitchField name={name} label={label} hint={hint} checked={checked && !disabled} onCheckedChange={setChecked} disabled={disabled} />;
}

export function Hidden({ values }: { values: Record<string, string | number> }) {
  return (
    <>
      {Object.entries(values).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={String(value)} />
      ))}
    </>
  );
}

export function TagFields({ providers, tag, withSite = false }: { providers: TrackingProvider[]; tag?: TrackingTag; withSite?: boolean }) {
  const standard = providers.filter((provider) => provider.code !== "script");
  const [provider, setProvider] = useState(tag?.provider ?? standard.find((item) => item.allowed)?.code ?? "ga4");
  const meta = standard.find((item) => item.code === provider) ?? standard[0];

  return (
    <>
      {tag ? (
        <p className="rounded-tile border border-line bg-surface-2/60 px-3 py-2 text-[13px] text-fg-2">
          {meta?.name} · las cookies de <b>{CONSENT_LABEL[meta?.consent ?? "analiticas"]}</b> la activan.
        </p>
      ) : (
        <SelectField label="Proveedor" name="provider" value={provider} onChange={setProvider} options={standard.map((item) => ({ value: item.code, label: item.allowed ? item.name : `${item.name} · desde ${item.min_plan}` }))} hint={meta ? `Carga con cookies de ${CONSENT_LABEL[meta.consent].toLowerCase()}.${meta.server ? ` Envío del servidor: ${meta.server}.` : ""}` : undefined} />
      )}
      {withSite && !tag && <SelectField label="Dónde carga" name="site" defaultValue="ambos" options={[{ value: "ambos", label: "Vitrina y blog" }, { value: "vitrina", label: "Solo la vitrina" }, { value: "blog", label: "Solo el blog" }]} />}
      <TextField label="Nombre" name="name" required minLength={3} maxLength={80} defaultValue={tag?.name} placeholder="Ej.: Google Ads · campañas Cusco" />
      <TextField label={meta?.id_label ?? "ID"} name="measurement_id" required defaultValue={tag?.measurement_id ?? undefined} placeholder={meta?.placeholder ?? undefined} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Cargar en" name="pages" defaultValue={tag?.pages ?? "/*"} hint="Rutas separadas por coma. /* es todo el sitio." />
        <TextField label="Excepto" name="exclude" defaultValue={tag?.exclude ?? ""} placeholder="/cuenta/*" hint="El pago siempre queda excluido." />
      </div>
      {meta?.server && <FormSwitch name="server_side" label="Enviar conversiones también desde el servidor" hint="No se pierden compras por bloqueadores; se deduplican con event_id." defaultChecked={tag?.server_side ?? false} />}
      {provider === "google_ads" && <FormSwitch name="enhanced_conversions" label="Conversiones mejoradas" hint="Correo y teléfono viajan solo cifrados con SHA-256." defaultChecked={tag?.enhanced_conversions ?? true} />}
      {meta?.server && <TextField label="Token del proveedor" name="secret" type="password" revealable autoComplete="off" placeholder={tag?.secret_saved ? "Guardado. Déjalo vacío para no cambiarlo." : "Pega el token de acceso"} hint="Se guarda cifrado y nunca vuelve al navegador." />}
    </>
  );
}

export function ScriptFields({ tag }: { tag?: TrackingTag }) {
  return (
    <>
      <TextField label="Nombre" name="name" required minLength={3} maxLength={80} defaultValue={tag?.name} placeholder="Ej.: Chat de ventas del proveedor X" />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Cookies que usa" name="consent_category" defaultValue={tag?.consent_category ?? "marketing"} options={[{ value: "marketing", label: "Marketing" }, { value: "analiticas", label: "Analíticas" }, { value: "necesarias", label: "Necesarias (justifícalo)" }]} />
        <SelectField label="Posición" name="placement" defaultValue={tag?.placement ?? "body_fin"} options={[{ value: "body_fin", label: "Final del body" }, { value: "head", label: "Head" }, { value: "body_inicio", label: "Inicio del body" }]} />
      </div>
      <TextField label="URL del script" name="script_src" defaultValue={tag?.script_src ?? undefined} placeholder="https://cdn.proveedor.com/widget.js" hint="Debe empezar con https://." />
      <TextField label="Hash SRI" name="sri_hash" defaultValue={tag?.sri_hash ?? undefined} placeholder="sha384-…" hint="Obligatorio si el script viene de otro servidor." />
      <TextArea label="O código en línea" name="script_body" rows={4} defaultValue={tag?.script_body ?? undefined} placeholder="window.dataLayer = window.dataLayer || [];" hint="Máximo 50 KB. No se permite eval, document.write ni leer datos de pago." />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Dominios que necesita (CSP)" name="csp_domains" required defaultValue={tag?.csp_domains.join(", ")} placeholder="cdn.proveedor.com, api.proveedor.com" />
        <TextField label="Páginas" name="pages" defaultValue={tag?.pages ?? "/*"} hint="Nunca carga en /checkout." />
      </div>
    </>
  );
}

export function WhenLabel({ at, prefix }: { at: string | null; prefix: string }) {
  if (!at) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[12px] text-fg-3">
      <Clock3 size={12} /> {prefix} {formatDateTime(at)}
    </span>
  );
}
