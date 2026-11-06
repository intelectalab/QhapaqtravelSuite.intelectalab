"use client";

import { Activity, BadgeCheck, CalendarDays, Code2, Globe, KeyRound, MousePointerClick, Palette, Plus, ShieldCheck, Star, Trash2, Users } from "lucide-react";
import { useState } from "react";
import { addDomain, removeDomain, saveWidgetDefaults, verifyDomain } from "@/app/(backoffice)/canales/integracion-web/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, MetricFilter } from "@/components/table/types";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextField } from "@/components/ui/TextField";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import type { WebDomain, WebEvent, WebOverview, WidgetDefaults } from "@/lib/channels";
import { formatDateTime, formatNumber } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import { ChannelBadge, TileGrid } from "./ChannelUi";

const initial: StepResult = { message: null, done: false };

export function WebTiles({ kpis }: { kpis: WebOverview["kpis"] }) {
  return (
    <TileGrid>
      <TintTile icon={ShieldCheck} tone="t1" label="Dominios verificados" value={`${kpis.verified} de ${kpis.domains}`} note={kpis.domains - kpis.verified > 0 ? `${kpis.domains - kpis.verified} esperan su registro DNS` : "Todos habilitados"} />
      <TintTile icon={Activity} tone="violet" label="Eventos registrados" value={formatNumber(kpis.events)} note="Del sitio y del widget" />
      <TintTile icon={Users} tone="t4" label="Sesiones" value={formatNumber(kpis.sessions)} note="Visitantes únicos con actividad" />
      <TintTile icon={MousePointerClick} tone="sun" label="Traspasos al checkout" value={formatNumber(kpis.handoffs)} note="Reservas iniciadas desde el widget" />
    </TileGrid>
  );
}

function snippet(overview: WebOverview): string {
  const config = overview.config;
  const d = overview.defaults;
  if (!config) return "";
  const attrs = `product="${d.product ?? ""}" lang="${d.lang}" currency="${d.currency}" theme="${d.theme}" radius="${d.radius}"${d.reviews ? " reviews" : ""}`;
  if (d.method === "iframe") return `<iframe src="${config.host}/widget/${d.product}?lang=${d.lang}&currency=${d.currency}" style="width:100%;min-height:640px;border:0;border-radius:${d.radius}px"></iframe>`;
  if (d.method === "link") return `${config.host}/widget/${d.product}?lang=${d.lang}&currency=${d.currency}`;
  if (d.method === "script") return `<script src="${config.cdn}/qhapaq.js" data-key="${config.public_key}" data-${attrs.replaceAll('" ', '" data-')}></script>\n<button data-qhapaq-open>Reservar</button>`;
  return `<script type="module" src="${config.cdn}/qhapaq-widget.js"></script>\n<qhapaq-booking key="${config.public_key}" ${attrs}></qhapaq-booking>`;
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
          <SelectField label="Producto" name="product" options={overview.products.map((product) => ({ value: product.code, label: product.name }))} defaultValue={d.product ?? overview.products[0]?.code} hint="Solo productos publicados en la tienda." />
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

export function WidgetCard({ overview }: { overview: WebOverview }) {
  const [copied, setCopied] = useState(false);
  const code = snippet(overview);
  const method = overview.methods.find((item) => item.value === overview.defaults.method)?.label ?? overview.defaults.method;
  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  return (
    <Card className="mb-5">
      <TintCardTitle icon={Code2} title="Widget de reservas" aside={overview.can_manage ? <DefaultsAction overview={overview} /> : undefined} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-3">
          <FieldList
            fields={[
              { label: "Clave pública", value: <span className="inline-flex items-center gap-1.5 font-mono text-[12.5px]"><KeyRound size={13} className="text-fg-3" />{overview.config?.public_key ?? "Sin clave"}</span> },
              { label: "Agencia", value: overview.config?.tenant_slug ?? "—" },
              { label: "Checkout", value: overview.config?.host ?? "—" },
              { label: "Método", value: method },
            ]}
          />
          <div className="relative">
            <pre className="scroll-thin max-h-48 overflow-auto whitespace-pre-wrap break-all rounded-tile bg-fg p-3.5 font-mono text-[12px] leading-relaxed text-bg">{code}</pre>
            <button type="button" onClick={copy} className="absolute right-2 top-2 rounded-md bg-surface/90 px-2 py-1 text-[11.5px] font-semibold text-fg transition-transform duration-300 hover:-translate-y-0.5">
              {copied ? "Copiado" : "Copiar"}
            </button>
          </div>
        </div>
        <WidgetPreview defaults={overview.defaults} />
      </div>
    </Card>
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

export function EventsCard({ events }: { events: WebEvent[] }) {
  return (
    <Card>
      <TintCardTitle icon={Activity} title="Últimos eventos" aside={`${events.length}`} />
      {events.length === 0 ? (
        <p className="text-[13px] text-fg-3">Aún no llegan eventos del sitio ni del widget.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {events.map((event, index) => (
            <li key={event.id} style={{ animationDelay: `${index * 50}ms` }} className="lift flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] items-center justify-between gap-3 rounded-tile border border-line px-3.5 py-2.5">
              <span className="min-w-0">
                <b className="block text-[13.5px] font-semibold">{EVENT_LABELS[event.event] ?? event.event}</b>
                <span className="block truncate text-[12px] text-fg-3">{event.params.title ?? event.params.page ?? "—"} · sesión {event.session}</span>
              </span>
              <span className="flex flex-none flex-col items-end text-[12px] text-fg-3">
                <span>{formatDateTime(event.at)}</span>
                <span>{event.locale.toUpperCase()} · {event.currency}{event.client ? ` · ${event.client}` : ""}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
