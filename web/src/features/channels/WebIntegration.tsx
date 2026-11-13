"use client";

import { Activity, BadgeCheck, BookOpen, CalendarDays, Code2, ExternalLink, Globe, KeyRound, type LucideIcon, MonitorSmartphone, MousePointerClick, PackageCheck, Palette, Plus, RefreshCw, ShieldCheck, Star, Trash2, Users, Webhook } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { addDomain, removeDomain, rotateWidgetKey, saveWidgetDefaults, verifyDomain } from "@/app/(backoffice)/canales/integracion-web/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { FieldList } from "@/components/ui/Details";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextField } from "@/components/ui/TextField";
import { TintTile } from "@/components/ui/Tinted";
import type { WebDomain, WebEvent, WebOverview, WidgetDefaults } from "@/lib/channels";
import { formatDate, formatDateTime, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import { ChannelBadge, CodeSnippet, TileGrid } from "./ChannelUi";

const initial: StepResult = { message: null, done: false };

export function WebTiles({ overview }: { overview: WebOverview }) {
  const { kpis } = overview;
  return (
    <TileGrid>
      <TintTile icon={Users} tone="t4" label="Sesiones" value={formatNumber(kpis.sessions)} note="Visitantes únicos con actividad" info={<p>Sesiones distintas que enviaron al menos un evento desde el sitio o el widget, con el consentimiento del visitante.</p>} />
      <TintTile icon={Activity} tone="violet" label="Eventos registrados" value={formatNumber(kpis.events)} note="Del sitio y del widget" info={<p>Vistas, productos vistos, carritos, checkouts y compras. La sección Eventos muestra los 50 más recientes.</p>} />
      <TintTile icon={MousePointerClick} tone="sun" label="Traspasos al checkout" value={formatNumber(kpis.handoffs)} note="Reservas iniciadas desde el widget" info={<p>Veces que el widget pasó una selección al checkout{kpis.sessions > 0 ? `: ${formatPercent((kpis.handoffs / kpis.sessions) * 100, 1)} de las sesiones` : ""}.</p>} />
      <TintTile icon={PackageCheck} tone="t1" label="Productos para el widget" value={formatNumber(overview.products.length)} note="Publicados en la tienda" info={<p>Solo los productos publicados en el canal e-commerce se pueden mostrar en el widget.</p>} />
    </TileGrid>
  );
}

function snippet(overview: WebOverview, method = overview.defaults.method): string {
  const config = overview.config;
  const d = overview.defaults;
  if (!config) return "";
  const sameHost = new URL(config.cdn).origin === new URL(config.host).origin;
  const hostAttr = sameHost ? "" : ` host="${config.host}"`;
  const catalog = d.mode === "catalogo";
  const target = catalog ? (d.category ? `category="${d.category}"` : "") : `product="${d.product ?? ""}"`;
  const attrs = `${target ? `${target} ` : ""}lang="${d.lang}" currency="${d.currency}" theme="${d.theme}" radius="${d.radius}"${d.reviews ? ' reviews="1"' : ""}${hostAttr}`;
  const url = widgetUrl(overview);
  if (method === "iframe") return `<iframe src="${url}" title="${catalog ? "Catálogo de viajes" : "Reserva en línea"}" loading="lazy" allow="payment" style="width:100%;min-height:${catalog ? 520 : 760}px;border:0;border-radius:${d.radius}px"></iframe>`;
  if (method === "link") return url;
  if (method === "script") return `<script src="${config.cdn}/kipucontrol.js" data-key="${config.public_key}" data-${attrs.replaceAll('" ', '" data-')}></script>\n<button data-kipucontrol-open>Reservar</button>`;
  const tag = catalog ? "kipucontrol-catalog" : "kipucontrol-booking";
  return `<script type="module" src="${config.cdn}/kipucontrol-widget.js"></script>\n<${tag} key="${config.public_key}" ${attrs}></${tag}>`;
}

function WidgetPreview({ defaults }: { defaults: WidgetDefaults }) {
  const radius = `${defaults.radius}px`;
  return (
    <div className="rounded-tile border border-line bg-surface-2/60 p-3">
      <div className="mb-2 flex items-center gap-1.5">
        {["#f87171", "#fbbf24", "#34d399"].map((color) => (
          <span key={color} className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
        ))}
        <span className="ml-2 truncate rounded-md bg-surface px-2 py-0.5 font-mono text-[11px] text-fg-3">{defaults.domain ?? "tu-sitio.pe"}</span>
      </div>
      <div className="lift border border-line bg-surface p-4 shadow-card" style={{ borderRadius: radius }}>
        <p className="text-[11.5px] font-semibold text-fg-3">{defaults.lang === "en" ? "Book online" : "Reserva en línea"}</p>
        <p className="mt-1 text-[15px] font-semibold leading-snug">{defaults.product_name ?? "Elige un producto"}</p>
        {defaults.reviews && (
          <p className="mt-1 flex items-center gap-1 text-[12px] text-fg-3">
            <Star size={12} className="fill-[var(--t2)] text-[var(--t2)]" /> {defaults.lang === "en" ? "Verified reviews" : "Reseñas verificadas"}
          </p>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
          <span className="flex items-center gap-1.5 border border-line px-2.5 py-2 text-fg-2" style={{ borderRadius: radius }}>
            <CalendarDays size={13} /> {defaults.lang === "en" ? "Date" : "Fecha"}
          </span>
          <span className="flex items-center gap-1.5 border border-line px-2.5 py-2 text-fg-2" style={{ borderRadius: radius }}>
            <Users size={13} /> 2 {defaults.lang === "en" ? "adults" : "adultos"}
          </span>
        </div>
        <button type="button" className="mt-3 w-full py-2.5 text-[13px] font-semibold text-white transition-transform duration-300 hover:-translate-y-0.5" style={{ background: defaults.theme, borderRadius: radius }}>
          {defaults.lang === "en" ? "Check availability" : "Ver disponibilidad"} · {defaults.currency}
        </button>
      </div>
    </div>
  );
}

function DefaultsAction({ overview }: { overview: WebOverview }) {
  const d = overview.defaults;
  const [reviews, setReviews] = useState(d.reviews);
  const [mode, setMode] = useState<string>(d.mode === "catalogo" ? "catalogo" : "producto");
  return (
    <PanelAction<StepResult>
      label="Configurar"
      icon={<Palette size={16} />}
      size="sm"
      formId="widget-defaults"
      title="Configurar el widget"
      description="Valores con los que se genera el código. Las páginas que ya lo usan toman los cambios al recargar."
      submitLabel="Guardar"
      action={saveWidgetDefaults}
      initial={initial}
    >
      {() => (
        <>
          <ChoiceGroup label="Qué muestra" name="mode" options={[{ value: "producto", label: "Un producto" }, { value: "catalogo", label: "Catálogo por categoría" }]} defaultValue={mode} onChange={setMode} />
          {mode === "catalogo" ? (
            <SelectField label="Categoría" name="category" options={(overview.categories ?? []).map((category) => ({ value: category, label: category }))} defaultValue={d.category ?? undefined} placeholder="Todas las categorías" clearable hint="El visitante elige el producto y pasa a reservarlo." />
          ) : (
            <SelectField label="Producto" name="product" options={overview.products.map((product) => ({ value: product.code, label: product.name }))} defaultValue={d.product ?? overview.products[0]?.code} hint="Solo productos publicados en la tienda." />
          )}
          <SelectField label="Método" name="method" options={overview.methods} defaultValue={d.method} />
          <div className="grid grid-cols-2 gap-3">
            <SelectField label="Idioma" name="lang" options={[{ value: "es", label: "Español" }, { value: "en", label: "Inglés" }]} defaultValue={d.lang} />
            <SelectField label="Moneda" name="currency" options={[{ value: "PEN", label: "Soles" }, { value: "USD", label: "Dólares" }]} defaultValue={d.currency} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Color" name="theme" defaultValue={d.theme} pattern="#[0-9A-Fa-f]{6}" icon={<Palette size={17} />} />
            <TextField label="Radio de esquinas" name="radius" type="number" min={0} max={24} defaultValue={d.radius} />
          </div>
          <SelectField label="Dominio de prueba" name="domain" options={overview.domains.filter((domain) => domain.status === "verificado").map((domain) => ({ value: domain.domain, label: domain.domain }))} defaultValue={d.domain ?? undefined} placeholder="Ninguno" />
          <SwitchField label="Mostrar reseñas verificadas" name="reviews" checked={reviews} onCheckedChange={setReviews} />
        </>
      )}
    </PanelAction>
  );
}

function SectionHead({ icon: Icon, title, aside }: { icon: LucideIcon; title: string; aside?: ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <p className="flex items-center gap-1.5 text-[14px] font-semibold">
        <Icon size={16} className="text-fg-3" /> {title}
      </p>
      {aside}
    </div>
  );
}

export function ConfiguratorSection({ overview }: { overview: WebOverview }) {
  const method = overview.methods.find((item) => item.value === overview.defaults.method)?.label ?? overview.defaults.method;
  const config = overview.config;
  const live = config && (overview.defaults.product || overview.defaults.mode === "catalogo") ? widgetUrl(overview) : null;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-3">
          <SectionHead
            icon={Code2}
            title="Widget de reservas"
            aside={
              <span className="flex flex-wrap items-center gap-2">
                {live && (
                  <a href={live} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 rounded-control border border-line px-3 text-[12.5px] font-semibold text-fg-2 transition hover:border-accent hover:text-accent">
                    <ExternalLink size={14} /> Abrir a pantalla completa
                  </a>
                )}
                {overview.can_rotate && config && <RotateKeyAction overview={overview} />}
                {overview.can_manage && <DefaultsAction overview={overview} />}
              </span>
            }
          />
          <FieldList
            fields={[
              {
                label: "Clave pública",
                value: (
                  <span className="flex flex-col">
                    <span className="inline-flex items-center gap-1.5 font-mono text-[12.5px]"><KeyRound size={13} className="text-fg-3" />{config?.public_key ?? "Sin clave"}</span>
                    {config?.previous_key_until && <span className="text-[12px] text-warn">La clave anterior funciona hasta el {formatDateTime(config.previous_key_until)}</span>}
                  </span>
                ),
              },
              { label: "Agencia", value: config?.tenant_slug ?? "—" },
              { label: "Checkout", value: config?.site ?? "—" },
              { label: "Script del widget", value: config ? <span className="font-mono text-[12px]">{config.cdn}</span> : "—" },
              { label: "Método", value: method },
              overview.defaults.mode === "catalogo" ? { label: "Muestra", value: overview.defaults.category ? `Catálogo · ${overview.defaults.category}` : "Catálogo completo" } : { label: "Producto", value: overview.defaults.product_name ?? "—" },
            ]}
          />
          <CodeSnippet code={snippet(overview)} />
        </div>
        <WidgetPreview defaults={overview.defaults} />
      </div>
      {live && <LivePreview url={live} domain={overview.defaults.domain} />}
    </div>
  );
}

function widgetUrl(overview: WebOverview): string {
  const config = overview.config;
  const d = overview.defaults;
  if (!config) return "";
  const catalog = d.mode === "catalogo";
  const category = catalog && d.category ? `&category=${encodeURIComponent(d.category)}` : "";
  return `${config.host}/widget/${catalog ? "catalogo" : d.product}?key=${config.public_key}&lang=${d.lang}&currency=${d.currency}&theme=${d.theme.slice(1)}&radius=${d.radius}&reviews=${d.reviews ? 1 : 0}${category}`;
}

function LivePreview({ url, domain }: { url: string; domain: string | null }) {
  return (
    <div>
      <SectionHead icon={MonitorSmartphone} title="Vista previa en vivo" aside={<span className="text-[12px] text-fg-3">El mismo widget que verán tus visitantes, con disponibilidad y precios reales</span>} />
      <div className="rounded-tile border border-line bg-surface-2/60 p-3">
        <div className="mb-2 flex items-center gap-1.5">
          {["#f87171", "#fbbf24", "#34d399"].map((color) => (
            <span key={color} className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
          ))}
          <span className="ml-2 truncate rounded-md bg-surface px-2 py-0.5 font-mono text-[11px] text-fg-3">{domain ?? "tu-sitio.pe"}</span>
        </div>
        <iframe src={url} title="Vista previa del widget" className="h-[720px] w-full rounded-tile border border-line bg-surface" />
      </div>
    </div>
  );
}

function RotateKeyAction({ overview }: { overview: WebOverview }) {
  return (
    <PanelAction<StepResult>
      label="Regenerar clave"
      icon={<RefreshCw size={15} />}
      size="sm"
      formId="widget-rotate-key"
      title="Regenerar la clave pública"
      description="La clave actual seguirá funcionando 24 horas para que actualices el código en tus sitios. Después, solo responde la nueva."
      submitLabel="Regenerar"
      action={rotateWidgetKey}
      initial={initial}
    >
      {() => (
        <>
          <FieldList fields={[{ label: "Clave actual", value: <span className="font-mono text-[12.5px]">{overview.config?.public_key}</span> }]} />
          <TextField label="Motivo" name="reason" required minLength={5} maxLength={300} placeholder="Por ejemplo: la clave quedó publicada en un repositorio" hint="Queda en la auditoría del widget." />
        </>
      )}
    </PanelAction>
  );
}

const METHOD_HINTS: Record<string, string> = {
  webcomponent: "Una etiqueta que se adapta al diseño del sitio. La opción recomendada.",
  iframe: "Una ventana aislada del sitio. Útil cuando el CMS no admite scripts.",
  script: "Un botón que abre el widget sobre la página.",
  link: "Una dirección para redes, correos o un botón propio.",
};

const PLATFORM_GUIDES = [
  { platform: "WordPress", method: "webcomponent", steps: "Bloque HTML personalizado en la página o entrada." },
  { platform: "Wix", method: "iframe", steps: "Elemento Insertar código y luego Insertar un sitio." },
  { platform: "Shopify", method: "script", steps: "Sección Liquid personalizada en el tema." },
  { platform: "Sitio propio", method: "webcomponent", steps: "Pega el código donde debe aparecer el widget." },
  { platform: "Redes y correo", method: "link", steps: "Usa el enlace directo en botones y mensajes." },
];

export function MethodsSection({ overview }: { overview: WebOverview }) {
  const label = (value: string) => overview.methods.find((method) => method.value === value)?.label ?? value;
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 xl:grid-cols-2">
        {overview.methods.map((method, index) => {
          const current = method.value === overview.defaults.method;
          return (
            <article key={method.value} style={{ animationDelay: `${index * 60}ms` }} className="lift flex min-w-0 animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-col gap-2.5 rounded-tile border border-line bg-surface p-4">
              <span className="flex items-center justify-between gap-2">
                <b className="text-[14px] font-semibold">{method.label}</b>
                {current && <ChannelBadge status="activo" label="Predeterminado" />}
              </span>
              <span className="text-[12.5px] text-fg-3">{METHOD_HINTS[method.value] ?? ""}</span>
              <CodeSnippet code={snippet(overview, method.value)} />
            </article>
          );
        })}
      </div>
      <div>
        <SectionHead icon={BookOpen} title="Guías por plataforma" />
        <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {PLATFORM_GUIDES.map((guide) => (
            <li key={guide.platform} className="lift flex items-start gap-3 rounded-tile border border-line px-3.5 py-3">
              <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-surface-2 text-fg-2">
                <MonitorSmartphone size={16} />
              </span>
              <span className="min-w-0">
                <b className="block text-[13.5px] font-semibold">{guide.platform}</b>
                <span className="block text-[12px] text-accent">{label(guide.method)}</span>
                <span className="block text-[12px] text-fg-3">{guide.steps}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function DomainsSection({ overview }: { overview: WebOverview }) {
  const verified = overview.domains.filter((domain) => domain.status === "verificado").map((domain) => `https://${domain.domain}`);
  const headers = verified.length ? `Content-Security-Policy: frame-ancestors 'self' ${verified.join(" ")}\nAccess-Control-Allow-Origin: ${verified[0]}${verified.length > 1 ? `\nVary: Origin` : ""}` : "";
  return (
    <div className="flex flex-col gap-6">
      <DomainsTable rows={overview.domains} canManage={overview.can_manage} />
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <div className="min-w-0">
          <SectionHead icon={ShieldCheck} title="Cabeceras que envía el widget" />
          {headers ? <CodeSnippet code={headers} /> : <p className="rounded-tile border border-dashed border-line px-4 py-5 text-center text-[13px] text-fg-3">Verifica un dominio para habilitar el widget.</p>}
          <p className="mt-2 text-[12px] text-fg-3">El origen permitido se responde según el dominio que pide el widget.</p>
        </div>
        <div>
          <SectionHead icon={BadgeCheck} title="Cómo verificar un dominio" />
          <ol className="flex flex-col gap-2">
            {["Agrega el dominio sin https:// ni rutas.", "Crea en tu DNS un registro TXT con el valor que te damos.", "Cuando el DNS se propague, pulsa Verificar."].map((step, index) => (
              <li key={step} className="lift flex items-center gap-3 rounded-tile border border-line px-3.5 py-2.5 text-[13px]">
                <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-accent/10 text-[12px] font-bold text-accent">{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

function AddDomainAction() {
  return (
    <PanelAction<StepResult>
      label="Agregar dominio"
      icon={<Plus size={16} strokeWidth={2.4} />}
      size="sm"
      formId="domain-new"
      title="Agregar dominio"
      description="El widget solo responde en dominios verificados. Te daremos un registro TXT para el DNS."
      submitLabel="Agregar"
      action={addDomain}
      initial={initial}
    >
      {() => (
        <>
          <TextField label="Dominio" name="domain" required placeholder="blog.tuagencia.pe" icon={<Globe size={17} />} />
          <TextField label="CMS o plataforma (opcional)" name="cms" maxLength={60} placeholder="WordPress, Wix, sitio propio" />
        </>
      )}
    </PanelAction>
  );
}

function DomainAction({ domain, kind }: { domain: WebDomain; kind: "verify" | "remove" }) {
  const verify = kind === "verify";
  return (
    <PanelAction<StepResult>
      label={verify ? "Verificar" : "Quitar"}
      formId={`domain-${kind}-${domain.id}`}
      title={verify ? "Verificar dominio" : "Quitar dominio"}
      description={verify ? `Comprueba que ${domain.domain} tenga el registro TXT ${domain.token}.` : `${domain.domain} dejará de cargar el widget.`}
      submitLabel={verify ? "Verificar" : "Quitar"}
      action={verify ? verifyDomain : removeDomain}
      initial={initial}
      trigger={(open) => <RowIcon tone={verify ? "view" : "delete"} label={verify ? "Verificar" : "Quitar"} icon={verify ? <BadgeCheck size={15} /> : <Trash2 size={15} />} onClick={open} />}
    >
      {() => <input type="hidden" name="id" value={domain.id} />}
    </PanelAction>
  );
}

export function DomainsTable({ rows, canManage }: { rows: WebDomain[]; canManage: boolean }) {
  const columns: Column<WebDomain>[] = [
    {
      id: "domain",
      header: "Dominio",
      mobile: "title",
      cell: (row) => (
        <span className="flex flex-col">
          <b className="font-mono text-[13px] font-semibold">{row.domain}</b>
          <span className="text-[12px] text-fg-3">{row.cms ?? "Sin especificar"}</span>
        </span>
      ),
    },
    { id: "token", header: "Registro TXT", wideOnly: true, cell: (row) => <span className="font-mono text-[12px] text-fg-2">{row.token}</span> },
    { id: "added", header: "Agregado", cell: (row) => <span className="text-[12.5px] text-fg-2">{row.added_by ?? "—"} · {formatDateTime(row.added_at)}</span> },
    { id: "status", header: "Estado", mobile: "detail", cell: (row) => <ChannelBadge status={row.status} /> },
    {
      id: "actions",
      header: "",
      cell: (row) => (
        <RowActions>
          {canManage && row.status !== "verificado" && <DomainAction domain={row} kind="verify" />}
          {canManage && <DomainAction domain={row} kind="remove" />}
        </RowActions>
      ),
    },
  ];
  const metrics: MetricFilter<WebDomain>[] = [
    { id: "ok", label: "Verificados", tone: "ok", icon: <ShieldCheck size={19} />, matches: (row) => row.status === "verificado" },
    { id: "pending", label: "Pendientes", tone: "warn", icon: <Globe size={19} />, matches: (row) => row.status !== "verificado" },
  ];
  return <DataTable screen="canales-web-dominios" rows={rows} columns={columns} getKey={(row) => row.id} entityLabel="dominios" searchText={(row) => `${row.domain} ${row.cms ?? ""}`} searchPlaceholder="Buscar dominio" metrics={metrics} toolbarEnd={canManage ? <AddDomainAction /> : undefined} emptyTitle="Sin dominios" />;
}

const EVENT_LABELS: Record<string, string> = { page_view: "Vista de página", view_item: "Vio un producto", add_to_cart: "Agregó al carrito", begin_checkout: "Inició el checkout", purchase: "Compró" };

const HOST_EVENTS = [
  { event: "kipucontrol:ready", when: "El widget cargó, con producto, idioma y moneda" },
  { event: "kipucontrol:resize", when: "Nuevo alto en píxeles para el iframe" },
  { event: "kipucontrol:date_selected", when: "El visitante eligió una fecha" },
  { event: "kipucontrol:quote", when: "Total recalculado, con total y moneda" },
  { event: "kipucontrol:checkout", when: "El visitante pulsó continuar y pasó al checkout" },
];

const GA4_SNIPPET = `document.querySelector("kipucontrol-booking")
  .addEventListener("kipucontrol:checkout", (event) => {
    gtag("event", "begin_checkout", { value: event.detail.total, currency: event.detail.currency });
  });`;

const HANDOFF_STATUS: Record<string, string> = { pendiente: "Pendiente", en_carrito: "En carrito", convertido: "Pedido creado", expirado: "Vencido" };

function IntegrationEvents({ overview }: { overview: WebOverview }) {
  const webhooks = overview.webhooks ?? [];
  const handoffs = overview.handoffs ?? [];
  return (
    <div className="flex flex-col gap-6">
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <div className="min-w-0">
          <SectionHead icon={Webhook} title="Webhooks relevantes" aside={overview.can_rotate ? <Link href="/admin/api" className="text-[12.5px] font-semibold text-accent hover:underline">Gestionar en API y webhooks</Link> : undefined} />
          <ul className="flex flex-col gap-2">
            {webhooks.map((hook, index) => (
              <li key={hook.event} style={{ animationDelay: `${index * 50}ms` }} className="lift flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] items-start justify-between gap-3 rounded-tile border border-line px-3.5 py-2.5" title={hook.endpoints.join(" · ") || undefined}>
                <span className="min-w-0">
                  <span className="block font-mono text-[12px] text-fg-2">{hook.event}</span>
                  <span className="block text-[12.5px] text-fg-3">{hook.when}</span>
                </span>
                {hook.subscriptions > 0 ? <ChannelBadge status="activo" label={hook.subscriptions === 1 ? "1 suscripción" : `${hook.subscriptions} suscripciones`} /> : <span className="flex-none text-[12px] text-fg-3">Sin suscripción</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[12px] text-fg-3">Se envían de servidor a servidor, firmados con HMAC-SHA256 y con reintentos.</p>
        </div>
        <div className="min-w-0">
          <SectionHead icon={MousePointerClick} title="Eventos en la página anfitriona" />
          <ul className="flex flex-col gap-1.5">
            {HOST_EVENTS.map((item) => (
              <li key={item.event} className="flex items-start gap-3 rounded-tile border border-line px-3.5 py-2">
                <span className="w-[190px] flex-none font-mono text-[12px] text-fg-2">{item.event}</span>
                <span className="text-[12.5px] text-fg-3">{item.when}</span>
              </li>
            ))}
          </ul>
          <p className="mb-2 mt-3 text-[12px] text-fg-3">Llegan como CustomEvent en la etiqueta y como postMessage desde el iframe, solo a dominios verificados. Ejemplo para GA4:</p>
          <CodeSnippet code={GA4_SNIPPET} />
        </div>
      </div>
      <div>
        <SectionHead icon={PackageCheck} title="Últimos traspasos al checkout" aside={<span className="text-[12px] text-fg-3">{handoffs.length} más recientes</span>} />
        {handoffs.length === 0 ? (
          <p className="rounded-tile border border-dashed border-line px-4 py-6 text-center text-[13px] text-fg-3">Aún no hay traspasos. Aparecen cuando un visitante pulsa continuar en el widget.</p>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {handoffs.map((handoff, index) => (
              <li key={handoff.code} style={{ animationDelay: `${index * 40}ms` }} className="lift flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] items-center justify-between gap-3 rounded-tile border border-line px-3.5 py-2.5">
                <span className="min-w-0">
                  <b className="block truncate text-[13px] font-semibold">{handoff.product ?? "Producto"}</b>
                  <span className="block text-[12px] text-fg-3">{handoff.code} · {formatDateTime(handoff.at, false)} · viaje {formatDate(handoff.date)} · {handoff.pax} pax{handoff.origin ? ` · ${handoff.origin}` : ""}</span>
                </span>
                <span className="flex flex-none flex-col items-end gap-1">
                  {handoff.total !== null && <b className="text-[13px]">{formatMoney(Number(handoff.total), handoff.currency)}</b>}
                  <ChannelBadge status={handoff.status === "convertido" || handoff.status === "en_carrito" ? "activo" : handoff.status === "expirado" ? "vencida" : "pendiente"} label={HANDOFF_STATUS[handoff.status] ?? handoff.status} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export function EventsSection({ events }: { events: WebEvent[] }) {
  const columns: Column<WebEvent>[] = [
    { id: "event", header: "Evento", mobile: "title", cell: (row) => <b className="text-[13.5px] font-semibold">{EVENT_LABELS[row.event] ?? row.event}</b> },
    { id: "detail", header: "Detalle", cell: (row) => <span className="block max-w-[260px] truncate text-[13px] text-fg-2">{row.params.title ?? row.params.page ?? "—"}</span> },
    { id: "session", header: "Sesión", wideOnly: true, cell: (row) => <span className="font-mono text-[12px] text-fg-3">{row.session}</span> },
    { id: "context", header: "Idioma y moneda", wideOnly: true, cell: (row) => <span className="text-[12.5px] text-fg-2">{row.locale.toUpperCase()} · {row.currency}{row.client ? ` · ${row.client}` : ""}</span> },
    { id: "at", header: "Fecha", mobile: "detail", cell: (row) => <span className="text-[12.5px] text-fg-2">{formatDateTime(row.at)}</span> },
  ];
  const filters: FilterConfig<WebEvent>[] = [{ id: "event", label: "Evento", options: [...new Set(events.map((row) => row.event))].map((value) => ({ value, label: EVENT_LABELS[value] ?? value })), value: (row) => row.event }];
  const sorts: SortOption<WebEvent>[] = [{ id: "at", label: "Fecha", type: "date", value: (row) => row.at }];
  return (
    <div className="flex flex-col gap-6">
      <DataTable screen="canales-web-eventos" rows={events} columns={columns} getKey={(row) => String(row.id)} entityLabel="eventos" searchText={(row) => `${row.event} ${row.params.title ?? ""} ${row.params.page ?? ""} ${row.session} ${row.client ?? ""}`} searchPlaceholder="Buscar evento, página o sesión" filters={filters} sorts={sorts} emptyTitle="Aún no llegan eventos del sitio ni del widget" />
      <div>
        <SectionHead icon={Activity} title="Eventos que se registran" />
        <ul className="flex flex-wrap gap-1.5">
          {Object.entries(EVENT_LABELS).map(([code, text]) => (
            <li key={code} className="lift rounded-full border border-line px-3 py-1 text-[12.5px]">
              <span className="font-mono text-fg-3">{code}</span> · {text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function WebIntegrationWorkspace({ overview, section }: { overview: WebOverview; section: "configurator" | "methods" | "domains" | "events" }) {
  if (section === "methods") return <MethodsSection overview={overview} />;
  if (section === "domains") return <DomainsSection overview={overview} />;
  if (section === "events")
    return (
      <div className="flex flex-col gap-8">
        <EventsSection events={overview.events} />
        <IntegrationEvents overview={overview} />
      </div>
    );
  return <ConfiguratorSection overview={overview} />;
}
