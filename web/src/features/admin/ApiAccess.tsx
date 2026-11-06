"use client";

import { Activity, Ban, CheckCircle2, KeyRound, Link2, Pause, Play, Plus, RotateCw, ShieldCheck, Trash2, Webhook as WebhookIcon, XCircle } from "lucide-react";
import { createContext, useContext, useState, type ReactNode } from "react";
import { createApiKey, createWebhook, deleteWebhook, revokeApiKey, setWebhookStatus, updateWebhook } from "@/app/(backoffice)/admin/api/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { FieldList } from "@/components/ui/Details";
import { PanelAction } from "@/components/ui/PanelAction";
import { SidePanel } from "@/components/ui/SidePanel";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { ToneScope } from "@/components/ui/Tinted";
import { ADMIN_INITIAL, type AdminActionState, type ApiKey, type ApiOverview, type Option, type Webhook, type WebhookDelivery } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import type { Tone } from "@/lib/tone";
import { CheckChips, FieldLabel, RISE, SecretReveal } from "./AdminParts";

const SecretContext = createContext<{ secret: { value: string; title: string } | null; reveal: (value: string, title: string) => void; clear: () => void }>({ secret: null, reveal: () => undefined, clear: () => undefined });

export function SecretProvider({ children }: { children: ReactNode }) {
  const [secret, setSecret] = useState<{ value: string; title: string } | null>(null);
  return <SecretContext.Provider value={{ secret, reveal: (value, title) => setSecret({ value, title }), clear: () => setSecret(null) }}>{children}</SecretContext.Provider>;
}

export function SecretSlot() {
  const { secret, clear } = useContext(SecretContext);
  return secret ? <SecretReveal secret={secret.value} title={secret.title} onClose={clear} /> : null;
}

const KEY_STATUS: Record<ApiKey["status"], { label: string; tone: Tone }> = { active: { label: "Activa", tone: "ok" }, revoked: { label: "Revocada", tone: "mute" }, expired: { label: "Vencida", tone: "warn" } };
const DELIVERY_STATUS: Record<WebhookDelivery["status"], { label: string; tone: Tone }> = { delivered: { label: "Entregado", tone: "ok" }, retrying: { label: "Reintentando", tone: "sun" }, failed: { label: "Fallido", tone: "bad" }, pending: { label: "En cola", tone: "mute" } };
const HOOK_STATUS: Record<Webhook["status"], { label: string; tone: Tone }> = { active: { label: "Activo", tone: "ok" }, paused: { label: "Pausado", tone: "mute" }, disabled: { label: "Deshabilitado", tone: "bad" } };

const label = (options: Option[], value: string) => options.find((option) => option.value === value)?.label ?? value;

export function ApiKeyCreateAction({ scopes, full }: { scopes: Option[]; full: string | null }) {
  const { reveal } = useContext(SecretContext);
  return (
    <PanelAction<AdminActionState>
      label="Nueva clave"
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      formId="api-key-create"
      title="Nueva clave de API"
      description={full ?? "La clave identifica a tu agencia, no a una persona. La verás completa una sola vez."}
      submitLabel="Crear clave"
      action={createApiKey}
      initial={ADMIN_INITIAL}
      onDone={(state) => state.secret && reveal(state.secret, `Clave ${state.label ?? ""} creada`)}
    >
      {() => (
        <>
          <TextField label="Nombre" name="name" required minLength={3} placeholder="Ej.: Sitio web — motor de reservas" />
          <ChoiceGroup label="Entorno" name="environment" options={[{ value: "live", label: "Producción" }, { value: "test", label: "Pruebas" }]} defaultValue="test" />
          <div>
            <FieldLabel hint="Concede solo lo necesario.">Permisos</FieldLabel>
            <CheckChips name="scopes" options={scopes} />
          </div>
          <TextField label="Vence el (opcional)" name="expires_at" type="date" />
          <TextField label="IP permitidas (opcional)" name="ips" placeholder="200.48.22.17, 161.132.8.40" hint="Si lo dejas vacío, acepta llamadas desde cualquier IP." />
        </>
      )}
    </PanelAction>
  );
}

function WebhookFields({ events, hook }: { events: Option[]; hook?: Webhook }) {
  return (
    <>
      {hook && <input type="hidden" name="code" value={hook.code} />}
      <TextField label="URL de destino" name="url" type="url" required defaultValue={hook?.url} placeholder="https://erp.miagencia.pe/webhooks" icon={<Link2 size={17} />} hint="Debe usar https y no apuntar a una red interna." />
      <TextField label="Descripción" name="description" maxLength={200} defaultValue={hook?.description ?? undefined} />
      <div>
        <FieldLabel hint="Recibirás un aviso firmado cada vez que ocurra.">Eventos</FieldLabel>
        <CheckChips name="events" options={events} defaultValues={hook?.events ?? []} />
      </div>
    </>
  );
}

export function WebhookCreateAction({ events, full }: { events: Option[]; full: string | null }) {
  const { reveal } = useContext(SecretContext);
  return (
    <PanelAction<AdminActionState>
      label="Nuevo webhook"
      icon={<WebhookIcon size={16} />}
      formId="webhook-create"
      title="Nuevo webhook"
      description={full ?? "Cada envío va firmado con un secreto. Lo verás completo una sola vez."}
      submitLabel="Crear webhook"
      action={createWebhook}
      initial={ADMIN_INITIAL}
      onDone={(state) => state.secret && reveal(state.secret, `Secreto del webhook ${state.label ?? ""}`)}
    >
      {() => <WebhookFields events={events} />}
    </PanelAction>
  );
}

function KeyDetail({ apiKey, scopes }: { apiKey: ApiKey; scopes: Option[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <RowIcon tone="view" label="Ver clave" onClick={() => setOpen(true)} />
      <SidePanel open={open} onOpenChange={setOpen} title={apiKey.name} description={`${apiKey.code} · ${apiKey.environment === "live" ? "Producción" : "Pruebas"}`}>
        <div className="flex flex-col gap-4">
          <code className="rounded-[12px] bg-surface-2 px-3 py-2.5 font-mono text-[13px]">{apiKey.masked}</code>
          <div className="flex flex-wrap gap-1.5">
            {apiKey.scopes.map((scope) => (
              <Badge key={scope} tone="t1">{label(scopes, scope)}</Badge>
            ))}
          </div>
          <FieldList
            fields={[
              { label: "Estado", value: <Badge tone={KEY_STATUS[apiKey.status].tone}>{KEY_STATUS[apiKey.status].label}</Badge> },
              { label: "Último uso", value: apiKey.last_used_at ? `${formatDateTime(apiKey.last_used_at)}${apiKey.last_used_ip ? ` · ${apiKey.last_used_ip}` : ""}` : "Nunca" },
              { label: "IP permitidas", value: apiKey.ips.length > 0 ? apiKey.ips.join(", ") : "Cualquiera" },
              { label: "Vence", value: apiKey.expires_at ? formatDate(apiKey.expires_at) : "No vence" },
              { label: "Creada", value: `${formatDateTime(apiKey.created_at)}${apiKey.created_by ? ` · ${apiKey.created_by}` : ""}` },
              ...(apiKey.revoked_at ? [{ label: "Revocada", value: `${formatDateTime(apiKey.revoked_at)} · ${apiKey.revoke_reason ?? ""}` }] : []),
            ]}
          />
        </div>
      </SidePanel>
    </>
  );
}

export function ApiKeysTable({ data }: { data: ApiOverview }) {
  const columns: Column<ApiKey>[] = [
    {
      id: "key",
      header: "Clave",
      mobile: "title",
      cell: (apiKey) => (
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold">{apiKey.name}</p>
          <p className="font-mono text-[11.5px] text-fg-3">{apiKey.masked}</p>
        </div>
      ),
    },
    { id: "env", header: "Entorno", cell: (apiKey) => <Badge tone={apiKey.environment === "live" ? "t1" : "violet"}>{apiKey.environment === "live" ? "Producción" : "Pruebas"}</Badge> },
    {
      id: "scopes",
      header: "Permisos",
      wideOnly: true,
      cell: (apiKey) => (
        <span className="text-[12.5px] text-fg-2" title={apiKey.scopes.map((scope) => label(data.scopes, scope)).join(", ")}>
          {apiKey.scopes.length} {apiKey.scopes.length === 1 ? "permiso" : "permisos"}
        </span>
      ),
    },
    { id: "used", header: "Último uso", cell: (apiKey) => <span className="text-[12.5px] text-fg-3">{apiKey.last_used_at ? formatDateTime(apiKey.last_used_at, false) : "Nunca"}</span> },
    { id: "status", header: "Estado", cell: (apiKey) => <Badge tone={KEY_STATUS[apiKey.status].tone}>{KEY_STATUS[apiKey.status].label}</Badge> },
    {
      id: "actions",
      header: "",
      align: "right",
      mobile: "detail",
      cell: (apiKey) => (
        <RowActions>
          <KeyDetail apiKey={apiKey} scopes={data.scopes} />
          {data.can_manage && apiKey.status === "active" && (
            <PanelAction<AdminActionState> label="Revocar" variant="ghost" size="sm" formId={`key-revoke-${apiKey.code}`} trigger={(open) => <RowIcon tone="delete" label="Revocar clave" icon={<Ban size={15} />} onClick={open} />} title="Revocar clave" description={`${apiKey.name} deja de funcionar al instante. Los sistemas que la usan recibirán un error 401.`} submitLabel="Revocar" action={revokeApiKey} initial={ADMIN_INITIAL}>
              {() => (
                <>
                  <input type="hidden" name="code" value={apiKey.code} />
                  <TextArea label="Motivo" name="reason" rows={2} required minLength={3} placeholder="Ej.: terminó la integración con el proveedor." />
                </>
              )}
            </PanelAction>
          )}
        </RowActions>
      ),
    },
  ];
  const metrics: MetricFilter<ApiKey>[] = [
    { id: "active", label: "Activas", tone: "ok", icon: <KeyRound size={19} />, matches: (apiKey) => apiKey.status === "active" },
    { id: "live", label: "En producción", tone: "t1", icon: <ShieldCheck size={19} />, matches: (apiKey) => apiKey.environment === "live" && apiKey.status === "active" },
    { id: "inactive", label: "Revocadas o vencidas", tone: "mute", icon: <Ban size={19} />, matches: (apiKey) => apiKey.status !== "active" },
  ];
  const filters: FilterConfig<ApiKey>[] = [{ id: "scope", label: "Permiso", options: data.scopes, value: (apiKey) => apiKey.scopes }];
  const sorts: SortOption<ApiKey>[] = [
    { id: "created", label: "Creación", type: "date", value: (apiKey) => apiKey.created_at },
    { id: "used", label: "Último uso", type: "date", value: (apiKey) => apiKey.last_used_at },
  ];
  return <DataTable screen="admin-api-keys" rows={data.keys} columns={columns} getKey={(apiKey) => apiKey.code} entityLabel="claves" searchText={(apiKey) => `${apiKey.name} ${apiKey.masked}`} searchPlaceholder="Buscar clave" metrics={metrics} filters={filters} sorts={sorts} />;
}

function WebhookCard({ hook, data, index }: { hook: Webhook; data: ApiOverview; index: number }) {
  const health: Tone = hook.status !== "active" ? "mute" : hook.failures >= 5 ? "bad" : hook.failures > 0 ? "warn" : "ok";
  const rate = hook.total > 0 ? Math.round((hook.delivered / hook.total) * 100) : null;
  return (
    <ToneScope tone={health}>
      <article style={{ animationDelay: `${index * 60}ms` }} className={cn("lift group flex h-full flex-col rounded-card border border-[color-mix(in_srgb,var(--tint)_25%,transparent)] bg-surface p-4 shadow-card", RISE)}>
        <div className="flex items-start gap-3">
          <span className="relative grid h-10 w-10 flex-none place-items-center rounded-[12px] bg-[color-mix(in_srgb,var(--tint)_14%,transparent)] text-[var(--tint)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-110">
            <WebhookIcon size={18} />
            {hook.status === "active" && <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-[var(--tint)] ring-2 ring-surface motion-safe:animate-pulse" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-mono text-[12.5px] font-semibold" title={hook.url}>
              {hook.url.replace("https://", "")}
            </p>
            <p className="truncate text-[12px] text-fg-3">{hook.description ?? hook.code}</p>
          </div>
          <Badge tone={HOOK_STATUS[hook.status].tone}>{HOOK_STATUS[hook.status].label}</Badge>
        </div>
        <div className="mt-3 flex flex-wrap gap-1">
          {hook.events.map((event) => (
            <span key={event} className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-fg-2" title={label(data.events, event)}>
              {event}
            </span>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
          <span className="rounded-[10px] bg-surface-2 px-2.5 py-1.5">
            <span className="block text-fg-3">Entregas</span>
            <b className="text-[14px]">{rate === null ? "—" : `${rate} %`}</b>
          </span>
          <span className="rounded-[10px] bg-surface-2 px-2.5 py-1.5">
            <span className="block text-fg-3">Fallos seguidos</span>
            <b className={cn("text-[14px]", hook.failures > 0 && "text-[var(--tint)]")}>{hook.failures}</b>
          </span>
          <span className="rounded-[10px] bg-surface-2 px-2.5 py-1.5">
            <span className="block text-fg-3">Último</span>
            <b className="text-[12.5px]">{hook.last_at ? formatDateTime(hook.last_at, false) : "—"}</b>
          </span>
        </div>
        <p className="mt-2 text-[11.5px] text-fg-3">
          Secreto <span className="font-mono">{hook.secret}</span> · versión {hook.api_version}
        </p>
        {data.can_manage && (
          <div className="mt-auto flex justify-end gap-1.5 border-t border-line-2 pt-3">
            <PanelAction<AdminActionState> label="Editar" variant="ghost" size="sm" formId={`hook-edit-${hook.code}`} trigger={(open) => <RowIcon tone="edit" label="Editar webhook" onClick={open} />} title="Editar webhook" description={hook.code} submitLabel="Guardar cambios" action={updateWebhook} initial={ADMIN_INITIAL}>
              {() => <WebhookFields events={data.events} hook={hook} />}
            </PanelAction>
            <PanelAction<AdminActionState>
              label={hook.status === "active" ? "Pausar" : "Reanudar"}
              variant="ghost"
              size="sm"
              formId={`hook-status-${hook.code}`}
              trigger={(open) => <RowIcon tone="neutral" label={hook.status === "active" ? "Pausar" : "Reanudar"} icon={hook.status === "active" ? <Pause size={15} /> : <Play size={15} />} onClick={open} />}
              title={hook.status === "active" ? "Pausar webhook" : "Reanudar webhook"}
              description={hook.status === "active" ? "Los eventos dejan de enviarse mientras esté en pausa." : "Se reinicia el contador de fallos y vuelve a recibir eventos."}
              submitLabel={hook.status === "active" ? "Pausar" : "Reanudar"}
              action={setWebhookStatus}
              initial={ADMIN_INITIAL}
            >
              {() => (
                <>
                  <input type="hidden" name="code" value={hook.code} />
                  <input type="hidden" name="mode" value={hook.status === "active" ? "pause" : "resume"} />
                </>
              )}
            </PanelAction>
            <PanelAction<AdminActionState> label="Eliminar" variant="ghost" size="sm" formId={`hook-delete-${hook.code}`} trigger={(open) => <RowIcon tone="delete" label="Eliminar webhook" icon={<Trash2 size={15} />} onClick={open} />} title="Eliminar webhook" description="Deja de recibir eventos. El historial de entregas se conserva." submitLabel="Eliminar" action={deleteWebhook} initial={ADMIN_INITIAL}>
              {() => <input type="hidden" name="code" value={hook.code} />}
            </PanelAction>
          </div>
        )}
      </article>
    </ToneScope>
  );
}

export function WebhooksGrid({ data }: { data: ApiOverview }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {data.webhooks.map((hook, index) => (
        <WebhookCard key={hook.code} hook={hook} data={data} index={index} />
      ))}
    </div>
  );
}

export function DeliveriesTable({ data }: { data: ApiOverview }) {
  const columns: Column<WebhookDelivery>[] = [
    {
      id: "event",
      header: "Evento",
      mobile: "title",
      cell: (delivery) => (
        <div className="min-w-0">
          <p className="font-mono text-[12.5px] font-semibold">{delivery.event}</p>
          <p className="text-[11.5px] text-fg-3">
            {delivery.entity ?? "—"} · {delivery.webhook}
          </p>
        </div>
      ),
    },
    {
      id: "result",
      header: "Respuesta",
      cell: (delivery) => (
        <span className="text-[12.5px]" title={delivery.error ?? undefined}>
          <b className={cn("font-mono", delivery.http !== null && delivery.http < 300 ? "text-ok" : "text-bad")}>{delivery.http ?? "sin respuesta"}</b>
          <span className="text-fg-3"> · {delivery.ms !== null ? `${delivery.ms} ms` : "—"}</span>
        </span>
      ),
    },
    { id: "attempt", header: "Intento", align: "right", wideOnly: true, cell: (delivery) => <span className="font-mono text-[12.5px]">{delivery.attempt}</span> },
    {
      id: "status",
      header: "Estado",
      cell: (delivery) => (
        <span className="flex flex-col items-start gap-0.5">
          <Badge tone={DELIVERY_STATUS[delivery.status].tone}>{DELIVERY_STATUS[delivery.status].label}</Badge>
          {delivery.next_retry_at && <span className="text-[11px] text-fg-3">Próximo: {formatDateTime(delivery.next_retry_at, false)}</span>}
        </span>
      ),
    },
    { id: "at", header: "Fecha", wideOnly: true, cell: (delivery) => <span className="text-[12.5px] text-fg-3">{formatDateTime(delivery.at, false)}</span> },
  ];
  const metrics: MetricFilter<WebhookDelivery>[] = [
    { id: "ok", label: "Entregadas", tone: "ok", icon: <CheckCircle2 size={19} />, matches: (delivery) => delivery.status === "delivered" },
    { id: "retry", label: "Reintentando", tone: "sun", icon: <RotateCw size={19} />, matches: (delivery) => delivery.status === "retrying" },
    { id: "failed", label: "Fallidas", tone: "bad", icon: <XCircle size={19} />, matches: (delivery) => delivery.status === "failed" },
  ];
  const filters: FilterConfig<WebhookDelivery>[] = [
    { id: "webhook", label: "Webhook", options: data.webhooks.map((hook) => ({ value: hook.code, label: hook.description ?? hook.code })), value: (delivery) => delivery.webhook },
    { id: "event", label: "Evento", options: data.events, value: (delivery) => delivery.event },
  ];
  const sorts: SortOption<WebhookDelivery>[] = [{ id: "at", label: "Fecha", type: "date", value: (delivery) => delivery.at }];
  return <DataTable screen="admin-webhook-entregas" rows={data.deliveries} columns={columns} getKey={(delivery) => delivery.code} entityLabel="entregas" searchText={(delivery) => `${delivery.event} ${delivery.entity ?? ""} ${delivery.webhook}`} searchPlaceholder="Buscar evento o documento" metrics={metrics} filters={filters} sorts={sorts} />;
}

export function OAuthApps({ apps, scopes }: { apps: ApiOverview["apps"]; scopes: Option[] }) {
  if (apps.length === 0) return <p className="text-[13px] text-fg-3">Ninguna aplicación externa tiene acceso por OAuth.</p>;
  return (
    <ul className="flex flex-col gap-2">
      {apps.map((app) => (
        <li key={app.vendor} className="flex items-start justify-between gap-3 rounded-[12px] border border-line px-3.5 py-3 transition-colors hover:border-accent/40">
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold">{app.name}</p>
            <p className="text-[12px] text-fg-3">{app.vendor}</p>
            <p className="mt-1 text-[12px] text-fg-2">{app.scopes.map((scope) => label(scopes, scope)).join(" · ")}</p>
          </div>
          <span className="flex flex-none flex-col items-end gap-1">
            <Badge tone={app.status === "active" ? "ok" : "mute"}>{app.status === "active" ? "Autorizada" : "Revocada"}</Badge>
            <span className="flex items-center gap-1 text-[11.5px] text-fg-3">
              <Activity size={12} /> {formatDateTime(app.last_token_at, false)}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
