"use client";

import { Activity, AppWindow, Ban, BarChart3, Check, Copy, KeyRound, Link2, Plus, RotateCw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { createOAuthApp, revokeOAuthApp, rotateOAuthSecret } from "@/app/(backoffice)/admin/api/actions";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PanelAction } from "@/components/ui/PanelAction";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { ADMIN_INITIAL, type AdminActionState, type Option } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { formatDateTime, formatNumber } from "@/lib/format";
import { CheckChips, FieldLabel, RISE } from "./AdminParts";
import { useSecretReveal } from "./ApiAccess";

export interface OAuthApp {
  id: string;
  client_id: string;
  name: string;
  vendor: string;
  scopes: string[];
  redirects: string[];
  status: "active" | "revoked";
  created_at: string;
  created_by: string | null;
  last_token_at: string | null;
  last_used_at: string | null;
  active_tokens: number;
  calls_month: number;
}

const scopeLabel = (scopes: Option[], value: string) => scopes.find((scope) => scope.value === value)?.label ?? value;

function ClientId({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <span className="mt-1 inline-flex max-w-full items-center gap-1.5 rounded-[9px] bg-surface-2 py-1 pl-2.5 pr-1 text-[11.5px]">
      <span className="text-fg-3">Client ID</span>
      <code className="truncate font-mono text-fg-2">{value}</code>
      <button
        type="button"
        aria-label="Copiar el client ID"
        onClick={() => {
          void navigator.clipboard.writeText(value).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
          });
        }}
        className="grid h-6 w-6 flex-none place-items-center rounded-[7px] text-fg-3 transition hover:bg-surface hover:text-fg"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </span>
  );
}

function AppStat({ icon, label, value, hint }: { icon: ReactNode; label: string; value: string; hint: string }) {
  return (
    <span className="flex items-center gap-1.5 text-[11.5px] text-fg-3" title={hint}>
      {icon}
      <span>
        <b className="font-semibold text-fg-2">{value}</b> {label}
      </span>
    </span>
  );
}

export function OAuthAppCreateAction({ scopes }: { scopes: Option[] }) {
  const reveal = useSecretReveal();
  return (
    <PanelAction<AdminActionState>
      label="Nueva aplicación"
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      formId="oauth-app-create"
      title="Nueva aplicación OAuth"
      description="La aplicación pedirá permiso a tu agencia con Authorization Code y PKCE. El secreto se muestra una sola vez."
      submitLabel="Registrar aplicación"
      action={createOAuthApp}
      initial={ADMIN_INITIAL}
      onDone={(state) => state.secret && reveal(state.secret, "Secreto de la aplicación OAuth")}
    >
      {() => (
        <>
          <TextField label="Nombre" name="name" required minLength={3} maxLength={120} placeholder="Ej.: Conector contable" />
          <TextField label="Proveedor" name="vendor" required minLength={2} maxLength={120} placeholder="Ej.: Contasis Cloud" />
          <div>
            <FieldLabel hint="Concede solo lo que la aplicación necesita.">Permisos</FieldLabel>
            <CheckChips name="scopes" options={scopes} />
          </div>
          <TextArea label="URL de retorno" name="redirect_uris" rows={3} required placeholder="https://proveedor.example.com/oauth/callback" hint="Una por línea, todas con https. Hasta cinco." />
        </>
      )}
    </PanelAction>
  );
}

function RotateAction({ app }: { app: OAuthApp }) {
  const reveal = useSecretReveal();
  return (
    <PanelAction<AdminActionState>
      label="Rotar secreto"
      formId={`oauth-rotate-${app.id}`}
      title="Rotar el secreto"
      description={`${app.name} dejará de funcionar con el secreto actual hasta que el proveedor cargue el nuevo.`}
      submitLabel="Rotar secreto"
      action={rotateOAuthSecret}
      initial={ADMIN_INITIAL}
      onDone={(state) => state.secret && reveal(state.secret, `Nuevo secreto de ${app.name}`)}
      trigger={(open) => <RowIcon tone="edit" label="Rotar secreto" icon={<RotateCw size={15} />} onClick={open} />}
    >
      {() => <input type="hidden" name="id" value={app.id} />}
    </PanelAction>
  );
}

function RevokeAction({ app }: { app: OAuthApp }) {
  return (
    <PanelAction<AdminActionState>
      label="Revocar"
      formId={`oauth-revoke-${app.id}`}
      title="Revocar la aplicación"
      description={`${app.vendor} pierde el acceso de inmediato y sus tokens dejan de valer. Para volver a conectarla hay que registrarla otra vez.`}
      submitLabel="Revocar acceso"
      action={revokeOAuthApp}
      initial={ADMIN_INITIAL}
      trigger={(open) => <RowIcon tone="delete" label="Revocar" icon={<Ban size={15} />} onClick={open} />}
    >
      {() => <input type="hidden" name="id" value={app.id} />}
    </PanelAction>
  );
}

export function OAuthAppList({ apps, scopes, canManage }: { apps: OAuthApp[]; scopes: Option[]; canManage: boolean }) {
  if (apps.length === 0) {
    return <EmptyState icon={<AppWindow size={20} />} title="Sin aplicaciones conectadas" description="Registra una aplicación cuando un proveedor necesite actuar en nombre de tu agencia sin compartir claves." />;
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {apps.map((app, index) => (
        <li key={app.id} style={{ animationDelay: `${index * 45}ms` }} className={cn("lift group flex flex-col gap-3 rounded-[14px] border border-line px-4 py-3.5 transition-colors hover:border-accent/40 sm:flex-row sm:items-start", RISE)}>
          <span className="grid h-10 w-10 flex-none place-items-center rounded-[11px] bg-accent/10 text-accent transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
            <AppWindow size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[14px] font-semibold">{app.name}</p>
              <Badge tone={app.status === "active" ? "ok" : "mute"}>{app.status === "active" ? "Autorizada" : "Revocada"}</Badge>
            </div>
            <p className="text-[12.5px] text-fg-3">{app.vendor}</p>
            <ClientId value={app.client_id} />
            <div className="mt-2 flex flex-wrap gap-1">
              {app.scopes.map((scope) => (
                <span key={scope} className="rounded-md bg-surface-2 px-2 py-0.5 text-[11.5px] text-fg-2" title={scope}>
                  {scopeLabel(scopes, scope)}
                </span>
              ))}
            </div>
            <ul className="mt-2 flex flex-col gap-0.5">
              {app.redirects.map((url) => (
                <li key={url} className="flex items-center gap-1.5 truncate font-mono text-[11.5px] text-fg-3">
                  <Link2 size={12} className="flex-none" /> {url}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-none flex-col items-end gap-2">
            <AppStat icon={<BarChart3 size={12} />} label="llamadas este mes" value={formatNumber(app.calls_month)} hint="Llamadas a la API hechas con los tokens de esta aplicación en el mes. Cuentan para la cuota mensual del plan." />
            <AppStat icon={<KeyRound size={12} />} label={app.active_tokens === 1 ? "acceso vigente" : "accesos vigentes"} value={formatNumber(app.active_tokens)} hint="Autorizaciones que la aplicación todavía puede renovar. Revocar la aplicación las anula todas." />
            <span className="flex items-center gap-1 text-[11.5px] text-fg-3" title="Última llamada a la API con un token de esta aplicación">
              <Activity size={12} /> {app.last_used_at ? formatDateTime(app.last_used_at, false) : app.last_token_at ? `Autorizada el ${formatDateTime(app.last_token_at, false)}` : "Sin uso"}
            </span>
            {canManage && app.status === "active" && (
              <RowActions>
                <RotateAction app={app} />
                <RevokeAction app={app} />
              </RowActions>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
