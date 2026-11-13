"use client";

import { Activity, Ban, BarChart3, Check, CheckCircle2, Gauge, KeyRound, KeySquare, Link2, Minus, Pause, Play, Plus, Radar, RotateCw, Send, ShieldCheck, Trash2, Webhook as WebhookIcon, XCircle } from "lucide-react";
import Link from "next/link";
import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { createApiKey, createWebhook, deleteWebhook, loadDelivery, pingWebhook, redeliverWebhook, revokeApiKey, rotateWebhookSecret, setWebhookStatus, updateWebhook } from "@/app/(backoffice)/admin/api/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { BarChart } from "@/components/ui/Charts";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { FieldList } from "@/components/ui/Details";
import { InfoTip } from "@/components/ui/InfoTip";
import { PanelAction } from "@/components/ui/PanelAction";
import { SidePanel } from "@/components/ui/SidePanel";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { TintCardTitle, ToneScope } from "@/components/ui/Tinted";
import { ADMIN_INITIAL, type AdminActionState, type ApiKey, type AuditEntry, type ApiOverview, type Option, type Webhook, type WebhookDelivery, type WebhookDeliveryDetail } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import type { Tone } from "@/lib/tone";
import { AuditTrail, CheckChips, FieldLabel, RISE, SecretReveal } from "./AdminParts";

const SecretContext = createContext<{ secret: { value: string; title: string } | null; reveal: (value: string, title: string) => void; clear: () => void }>({ secret: null, reveal: () => undefined, clear: () => undefined });

export function SecretProvider({ children }: { children: ReactNode }) {
  const [secret, setSecret] = useState<{ value: string; title: string } | null>(null);
  return <SecretContext.Provider value={{ secret, reveal: (value, title) => setSecret({ value, title }), clear: () => setSecret(null) }}>{children}</SecretContext.Provider>;
}

export function useSecretReveal() {
  return useContext(SecretContext).reveal;
}

export function SecretSlot() {
  const { secret, clear } = useContext(SecretContext);
  return secret ? <SecretReveal secret={secret.value} title={secret.title} onClose={clear} /> : null;
}

const KEY_STATUS: Record<ApiKey["status"], { label: string; tone: Tone }> = { active: { label: "Activa", tone: "ok" }, revoked: { label: "Revocada", tone: "mute" }, expired: { label: "Vencida", tone: "warn" } };
const DELIVERY_STATUS: Record<WebhookDelivery["status"], { label: string; tone: Tone }> = { delivered: { label: "Entregado", tone: "ok" }, retrying: { label: "Reintentando", tone: "sun" }, failed: { label: "Fallido", tone: "bad" }, pending: { label: "En cola", tone: "mute" } };
const WARN_FAILURES = 5;

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
          <TextField label="IP permitidas (opcional)" name="ips" placeholder="200.48.22.17, 161.132.8.0/24" hint="Direcciones o rangos CIDR separados por comas. Si lo dejas vacío, acepta llamadas desde cualquier IP." />
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

const SCOPE_RESOURCES: { key: string; label: string }[] = [
  { key: "catalog", label: "Catálogo" },
  { key: "availability", label: "Disponibilidad" },
  { key: "quotes", label: "Cotizaciones" },
  { key: "reservations", label: "Reservas" },
  { key: "crm", label: "CRM" },
  { key: "payments", label: "Pagos" },
  { key: "invoices", label: "Comprobantes" },
  { key: "webhooks", label: "Webhooks" },
];

function ScopeMatrix({ granted, labels, compact = false }: { granted: string[]; labels: Option[]; compact?: boolean }) {
  const resources = SCOPE_RESOURCES.filter((resource) => !compact || granted.some((scope) => scope.startsWith(`${resource.key}:`)));
  const known = new Set(SCOPE_RESOURCES.map((resource) => resource.key));
  const others = granted.filter((scope) => !known.has(scope.split(":")[0]));
  const cell = (scope: string) => (granted.includes(scope) ? <Check size={14} className="mx-auto text-ok" aria-label="Sí" /> : <Minus size={14} className="mx-auto text-fg-3/50" aria-label="No" />);
  return (
    <div className="overflow-hidden rounded-[12px] border border-line">
      <table className="w-full text-[12.5px]">
        <thead>
          <tr className="bg-surface-2 text-[11.5px] text-fg-3">
            <th className="px-3 py-1.5 text-left font-medium">Recurso</th>
            <th className="w-20 px-2 py-1.5 text-center font-medium">Lectura</th>
            <th className="w-20 px-2 py-1.5 text-center font-medium">Escritura</th>
          </tr>
        </thead>
        <tbody>
          {resources.map((resource) => (
            <tr key={resource.key} className="border-t border-line-2">
              <td className="px-3 py-1.5">{resource.label}</td>
              <td className="px-2 py-1.5">{cell(`${resource.key}:read`)}</td>
              <td className="px-2 py-1.5">{resource.key === "webhooks" ? cell("webhooks:manage") : cell(`${resource.key}:write`)}</td>
            </tr>
          ))}
          {others.map((scope) => (
            <tr key={scope} className="border-t border-line-2">
              <td colSpan={3} className="px-3 py-1.5 text-[12px] text-fg-2">{label(labels, scope)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KeyDetail({ apiKey, scopes, history }: { apiKey: ApiKey; scopes: Option[]; history: AuditEntry[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <RowIcon tone="view" label="Ver clave" onClick={() => setOpen(true)} />
      <SidePanel open={open} onOpenChange={setOpen} title={apiKey.name} description={`${apiKey.code} · ${apiKey.environment === "live" ? "Producción" : "Pruebas"}`}>
        <div className="flex flex-col gap-4">
          <code className="rounded-[12px] bg-surface-2 px-3 py-2.5 font-mono text-[13px]">{apiKey.masked}</code>
          <ScopeMatrix granted={apiKey.scopes} labels={scopes} />
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
          <AuditTrail entries={history.filter((entry) => entry.entity_id === apiKey.code)} title="Bitácora de la clave" empty="Sin cambios registrados para esta clave." />
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
          <KeyDetail apiKey={apiKey} scopes={data.scopes} history={data.key_history} />
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
  const filters: FilterConfig<ApiKey>[] = [
    { id: "status", label: "Estado", options: Object.entries(KEY_STATUS).map(([value, item]) => ({ value, label: item.label })), value: (apiKey) => apiKey.status },
    { id: "env", label: "Entorno", options: [{ value: "live", label: "Producción" }, { value: "test", label: "Pruebas" }], value: (apiKey) => apiKey.environment },
    { id: "scope", label: "Permiso", options: data.scopes, value: (apiKey) => apiKey.scopes },
  ];
  const sorts: SortOption<ApiKey>[] = [
    { id: "created", label: "Creación", type: "date", value: (apiKey) => apiKey.created_at },
    { id: "used", label: "Último uso", type: "date", value: (apiKey) => apiKey.last_used_at },
  ];
  return <DataTable screen="admin-api-keys" rows={data.keys} columns={columns} getKey={(apiKey) => apiKey.code} entityLabel="claves" searchText={(apiKey) => `${apiKey.name} ${apiKey.masked}`} searchPlaceholder="Buscar clave" metrics={metrics} filters={filters} sorts={sorts} />;
}

function WebhookTools({ hook }: { hook: Webhook }) {
  const { reveal } = useContext(SecretContext);
  return (
    <>
      <PanelAction<AdminActionState> label="Ping" variant="ghost" size="sm" formId={`hook-ping-${hook.code}`} trigger={(open) => <RowIcon tone="neutral" label="Enviar ping de prueba" icon={<Radar size={15} />} onClick={open} disabledHint={hook.status === "active" ? undefined : "Reanuda el webhook para probarlo"} />} title="Enviar ping" description={`Envía el evento «ping» firmado a ${hook.url} y espera la respuesta. No cuenta como fallo si no responde.`} submitLabel="Enviar ping" action={pingWebhook} initial={ADMIN_INITIAL}>
        {() => <input type="hidden" name="code" value={hook.code} />}
      </PanelAction>
      <PanelAction<AdminActionState> label="Rotar secreto" variant="ghost" size="sm" formId={`hook-rotate-${hook.code}`} trigger={(open) => <RowIcon tone="neutral" label="Rotar secreto" icon={<KeySquare size={15} />} onClick={open} />} title="Rotar secreto" description="Se genera un secreto nuevo y lo verás una sola vez. Durante 24 horas cada envío lleva las dos firmas, para que actualices tu sistema sin perder eventos." submitLabel="Rotar secreto" action={rotateWebhookSecret} initial={ADMIN_INITIAL} onDone={(state) => state.secret && reveal(state.secret, `Nuevo secreto del webhook ${hook.code}`)}>
        {() => <input type="hidden" name="code" value={hook.code} />}
      </PanelAction>
    </>
  );
}

function WebhookCard({ hook, data, index }: { hook: Webhook; data: ApiOverview; index: number }) {
  const health: Tone = hook.status === "disabled" ? "bad" : hook.status !== "active" ? "mute" : hook.failures >= WARN_FAILURES ? "bad" : hook.failures > 0 ? "warn" : "ok";
  const toggle = hook.status === "active" ? { label: "Pausar", title: "Pausar webhook", description: "Los eventos dejan de enviarse mientras esté en pausa.", mode: "pause" } : hook.status === "disabled" ? { label: "Reactivar", title: "Reactivar webhook", description: "Revisa primero que tu servidor responda. Se reinicia el contador de fallos y vuelve a recibir eventos.", mode: "resume" } : { label: "Reanudar", title: "Reanudar webhook", description: "Vuelve a recibir eventos desde ahora.", mode: "resume" };
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
        <div className="mt-3 flex items-center gap-1.5">
          <Badge tone="t1">{hook.events.length === 1 ? "1 evento" : `${hook.events.length} eventos`}</Badge>
          <InfoTip label="Eventos suscritos">
            <span className="flex flex-col gap-1 text-left">
              {hook.events.map((event) => (
                <span key={event}>{label(data.events, event)}</span>
              ))}
            </span>
          </InfoTip>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-[12px]">
          <span className="rounded-[10px] bg-surface-2 px-2.5 py-1.5">
            <span className="block text-fg-3">Entregas</span>
            <b className="text-[14px]">{rate === null ? "—" : `${rate} %`}</b>
          </span>
          <span className="rounded-[10px] bg-surface-2 px-2.5 py-1.5">
            <span className="block text-fg-3">Fallos seguidos</span>
            <b className={cn("text-[14px]", hook.failures > 0 && "text-[var(--tint)]")}>
              {hook.failures}
              <span className="text-[12px] font-medium text-fg-3"> / {hook.failure_limit}</span>
            </b>
          </span>
          <span className="rounded-[10px] bg-surface-2 px-2.5 py-1.5">
            <span className="block text-fg-3">Último</span>
            <b className="text-[12.5px]">{hook.last_at ? formatDateTime(hook.last_at, false) : "—"}</b>
          </span>
        </div>
        {hook.status === "disabled" ? (
          <p className="mt-3 rounded-[10px] bg-bad/[0.08] px-3 py-2 text-[12.5px] text-fg-2">
            <b className="font-semibold text-bad">Se deshabilitó solo{hook.disabled_reason ? `: ${hook.disabled_reason.toLowerCase()}` : ""}.</b> Revisa tu servidor y reactívalo para volver a recibir eventos.
          </p>
        ) : hook.status === "active" && hook.failures >= WARN_FAILURES ? (
          <p className="mt-3 rounded-[10px] bg-warn/[0.1] px-3 py-2 text-[12.5px] text-fg-2">
            Lleva {hook.failures} fallos seguidos. Al llegar a {hook.failure_limit} se deshabilita y deja de recibir eventos.
          </p>
        ) : null}
        <p className="mt-2 text-[11.5px] text-fg-3">
          Secreto <span className="font-mono">{hook.secret}</span> · versión {hook.api_version}
          {hook.rotated_at ? ` · rotado el ${formatDate(hook.rotated_at)}` : ""}
          {" · "}
          <Link href={`/admin/api/entregas?webhook=${encodeURIComponent(hook.code)}`} className="font-semibold text-accent hover:underline">
            Ver entregas
          </Link>
        </p>
        {data.can_manage && (
          <div className="mt-auto flex justify-end gap-1.5 border-t border-line-2 pt-3">
            <WebhookTools hook={hook} />
            <PanelAction<AdminActionState> label="Editar" variant="ghost" size="sm" formId={`hook-edit-${hook.code}`} trigger={(open) => <RowIcon tone="edit" label="Editar webhook" onClick={open} />} title="Editar webhook" description={hook.code} submitLabel="Guardar cambios" action={updateWebhook} initial={ADMIN_INITIAL}>
              {() => <WebhookFields events={data.events} hook={hook} />}
            </PanelAction>
            <PanelAction<AdminActionState>
              label={toggle.label}
              variant="ghost"
              size="sm"
              formId={`hook-status-${hook.code}`}
              trigger={(open) => <RowIcon tone="neutral" label={toggle.label} icon={hook.status === "active" ? <Pause size={15} /> : <Play size={15} />} onClick={open} />}
              title={toggle.title}
              description={toggle.description}
              submitLabel={toggle.label}
              action={setWebhookStatus}
              initial={ADMIN_INITIAL}
            >
              {() => (
                <>
                  <input type="hidden" name="code" value={hook.code} />
                  <input type="hidden" name="mode" value={toggle.mode} />
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

function DeliveryDetail({ delivery, canManage }: { delivery: WebhookDelivery; canManage: boolean }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<WebhookDeliveryDetail | null>(null);
  const [pending, start] = useTransition();
  const show = () => {
    setOpen(true);
    start(async () => setDetail(await loadDelivery(delivery.code)));
  };
  return (
    <>
      <RowIcon tone="view" label="Ver entrega" onClick={show} />
      <SidePanel open={open} onOpenChange={setOpen} title={`Entrega ${delivery.code}`} description={`${delivery.event} · ${delivery.webhook}`} size="wide">
        {pending || !detail ? (
          <p className="text-[13px] text-fg-3">{pending ? "Cargando la entrega…" : "No pudimos cargar la entrega."}</p>
        ) : (
          <div className="flex flex-col gap-4 text-[13px]">
            <div className="flex flex-wrap gap-2">
              <Badge tone={DELIVERY_STATUS[detail.status].tone}>{DELIVERY_STATUS[detail.status].label}</Badge>
              {detail.manual && <Badge tone="violet" dot={false}>Reenvío manual</Badge>}
              <Badge tone="mute" dot={false}>Intento {detail.attempt}</Badge>
            </div>
            <FieldList
              fields={[
                { label: "Destino", value: <span className="break-all font-mono text-[12px]">{detail.url}</span> },
                { label: "Respuesta", value: `${detail.http ?? "sin respuesta"}${detail.ms !== null ? ` · ${detail.ms} ms` : ""}` },
                { label: "Evento", value: <span className="font-mono text-[12px]">{detail.event_id}</span> },
                { label: "Fecha", value: formatDateTime(detail.at) },
                ...(detail.error ? [{ label: "Error", value: detail.error }] : []),
              ]}
            />
            <div>
              <p className="mb-1.5 text-[12.5px] font-semibold text-fg-3">Cabeceras</p>
              <pre className="scroll-thin overflow-x-auto rounded-[12px] bg-surface-2 p-3 font-mono text-[11.5px] leading-relaxed">{Object.entries(detail.headers).map(([key, value]) => `${key}: ${value}`).join("\n")}</pre>
            </div>
            <div>
              <p className="mb-1.5 text-[12.5px] font-semibold text-fg-3">Cuerpo enviado</p>
              <pre className="scroll-thin max-h-64 overflow-auto rounded-[12px] bg-surface-2 p-3 font-mono text-[11.5px] leading-relaxed">{JSON.stringify(detail.payload, null, 2)}</pre>
            </div>
            {detail.response && (
              <div>
                <p className="mb-1.5 text-[12.5px] font-semibold text-fg-3">Respuesta del destino</p>
                <pre className="scroll-thin max-h-40 overflow-auto rounded-[12px] bg-surface-2 p-3 font-mono text-[11.5px]">{detail.response}</pre>
              </div>
            )}
            {detail.related.length > 0 && (
              <div>
                <p className="mb-1.5 text-[12.5px] font-semibold text-fg-3">Otros envíos del mismo evento</p>
                <ul className="flex flex-col gap-1">
                  {detail.related.map((item) => (
                    <li key={item.code} className="flex justify-between gap-2 rounded-[10px] bg-surface-2 px-3 py-1.5 text-[12.5px]">
                      <span className="font-mono">{item.code}{item.manual ? " · manual" : ""}</span>
                      <span className="text-fg-3">{item.http ?? "—"} · {formatDateTime(item.at, false)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {canManage && (
              <PanelAction<AdminActionState> label="Reenviar ahora" icon={<Send size={15} />} formId={`redeliver-${detail.code}`} title="Reenviar entrega" description="Se crea una entrega nueva y manual con el mismo evento y cuerpo, firmada con el secreto vigente." submitLabel="Reenviar" action={redeliverWebhook} initial={ADMIN_INITIAL} onDone={() => setOpen(false)}>
                {() => <input type="hidden" name="code" value={detail.code} />}
              </PanelAction>
            )}
          </div>
        )}
      </SidePanel>
    </>
  );
}

export function DeliveriesTable({ data, webhook }: { data: ApiOverview; webhook?: string }) {
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
    {
      id: "actions",
      header: "",
      align: "right",
      mobile: "detail",
      cell: (delivery) => (
        <RowActions>
          <DeliveryDetail delivery={delivery} canManage={data.can_manage} />
        </RowActions>
      ),
    },
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
  return <DataTable screen="admin-webhook-entregas" initialFilters={webhook ? { webhook } : undefined} rows={data.deliveries} columns={columns} getKey={(delivery) => delivery.code} entityLabel="entregas" searchText={(delivery) => `${delivery.event} ${delivery.entity ?? ""} ${delivery.webhook}`} searchPlaceholder="Buscar evento o documento" metrics={metrics} filters={filters} sorts={sorts} />;
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
            <div className="mt-2 max-w-[360px]">
              <ScopeMatrix granted={app.scopes} labels={scopes} compact />
            </div>
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

const monthLabel = (month: string) => new Intl.DateTimeFormat("es-PE", { month: "short", year: "2-digit" }).format(new Date(`${month}-01T12:00:00`)).replace(/\./g, "");

export function ApiLimits({ data }: { data: ApiOverview }) {
  const active = data.keys.filter((apiKey) => apiKey.status === "active").length;
  const hooks = data.webhooks.length;
  const remaining = (limit: number | null, used: number) => (limit === null ? "Sin límite en tu plan" : limit - used > 0 ? `Te quedan ${formatNumber(limit - used)}` : "Llegaste al máximo");
  const share = data.limits.calls_month ? Math.min(100, (data.calls_month / data.limits.calls_month) * 100) : null;
  const limits = [
    { icon: Activity, label: "Llamadas al mes", value: data.limits.calls_month, note: share === null ? "Sin límite en tu plan" : `Usaste el ${share.toFixed(0)} % este mes`, share },
    { icon: Gauge, label: "Llamadas por minuto", value: data.limits.rate_per_min, note: "Por agencia, sumando todas las claves", share: null },
    { icon: KeyRound, label: "Claves activas", value: data.limits.api_keys, note: remaining(data.limits.api_keys, active), share: null },
    { icon: WebhookIcon, label: "Webhooks", value: data.limits.webhooks, note: remaining(data.limits.webhooks, hooks), share: null },
  ];
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <TintCardTitle icon={ShieldCheck} title="Límites de tu plan" aside={`API ${data.api_version}`} />
        <ul className="flex flex-col">
          {limits.map((limit, index) => (
            <li key={limit.label} style={{ animationDelay: `${index * 45}ms` }} className={cn("group flex items-center gap-3 rounded-[11px] px-2 py-2.5 transition-colors hover:bg-surface-2", RISE)}>
              <span className="grid h-9 w-9 flex-none place-items-center rounded-[10px] bg-surface-2 text-accent transition-transform duration-200 group-hover:scale-110">
                <limit.icon size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold">{limit.label}</span>
                <span className="block text-[12px] text-fg-3">{limit.note}</span>
                {limit.share !== null && (
                  <span className="mt-1.5 block h-1.5 max-w-[320px] overflow-hidden rounded-full bg-surface-2">
                    <span className={cn("block h-full origin-left rounded-full motion-safe:animate-[fill-x_700ms_cubic-bezier(0.4,0,0.2,1)_backwards]", limit.share >= 100 ? "bg-bad" : limit.share >= 80 ? "bg-warn" : "bg-accent")} style={{ width: `${Math.max(limit.share, 2)}%` }} />
                  </span>
                )}
              </span>
              <span className="font-mono text-[14px] font-semibold">{limit.value === null ? "Sin límite" : formatNumber(limit.value)}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card>
        <TintCardTitle icon={BarChart3} title="Llamadas por mes" />
        {data.calls_history.length === 0 ? (
          <p className="text-[13px] text-fg-3">Tu agencia aún no registra llamadas a la API.</p>
        ) : (
          <BarChart data={data.calls_history.map((item, index) => ({ label: monthLabel(item.month), value: item.value, caption: formatNumber(item.value), detail: `${formatNumber(item.value)} llamadas`, highlight: index === data.calls_history.length - 1 }))} height={120} />
        )}
      </Card>
    </div>
  );
}
