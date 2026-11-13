"use client";

import { ArrowRight, Ban, CircleAlert, FileSearch, Globe, Link2, Lock, MousePointerClick, Plus, RefreshCw, Route, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { addDomain, addRedirect, disableRedirect, retireDomain, runAudit, savePage, verifyDomain } from "@/app/(backoffice)/canales/seo/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import type { Column, MetricFilter, SortOption } from "@/components/table/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { TintTile } from "@/components/ui/Tinted";
import { CodeSnippet, TileGrid } from "@/features/channels/ChannelUi";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import type { DomainsOverview, RedirectsOverview, SeoOverview, SeoPage, SiteDomain, SiteRedirect } from "@/lib/vitrina";
import { initialStep, QuickAction, ScoreRing, TabCard, VitrinaBadge } from "./VitrinaUi";

const PURPOSE_LABELS: Record<string, string> = { principal: "Sitio principal", reservas: "Reservas", blog: "Blog", aventuras: "Aventuras", portal: "Portal" };

export function BrandTiles({ domains, seo, redirects }: { domains: DomainsOverview; seo: SeoOverview; redirects: RedirectsOverview }) {
  return (
    <TileGrid>
      <TintTile icon={Globe} tone="t1" label="Dominios" value={domains.kpis.total} note={`${domains.kpis.verified} verificados`} info={<p>Dominios propios registrados, sin contar los retirados. Mientras no estén verificados, el sitio sigue en {domains.fallback_host}.</p>} />
      <TintTile icon={FileSearch} tone={seo.kpis.average !== null && seo.kpis.average >= 80 ? "ok" : "sun"} label="Puntaje SEO medio" value={seo.kpis.average === null ? "—" : `${seo.kpis.average} / 100`} note={`${seo.kpis.pages} páginas auditadas`} info={<p>Promedio de la auditoría por página: título, descripción, H1, texto, imágenes con alt, datos estructurados, canónica, velocidad y palabra clave.</p>} />
      <TintTile icon={MousePointerClick} tone="info" label="Clics orgánicos (28 d)" value={formatNumber(seo.kpis.clicks_28d)} note="Search Console" info={<p>Clics desde Google de los últimos 28 días, sumados por página. Se actualizan con el adaptador de Search Console.</p>} />
      <TintTile icon={Route} tone="violet" label="Redirecciones activas" value={redirects.kpis.active} note={`${formatNumber(redirects.kpis.hits)} visitas recuperadas`} info={<p>Rutas antiguas que llevan a su página nueva sin perder posicionamiento.</p>} />
    </TileGrid>
  );
}

function AddDomainAction({ purposes }: { purposes: string[] }) {
  return (
    <PanelAction<StepResult> label="Agregar dominio" icon={<Plus size={15} />} size="sm" formId="seo-domain-new" title="Agregar dominio" description="Le daremos los registros DNS que debe crear en su proveedor de dominio." submitLabel="Agregar" action={addDomain} initial={initialStep}>
      {() => (
        <>
          <TextField label="Dominio o subdominio" name="host" required placeholder="tours.miagencia.pe" maxLength={253} />
          <SelectField label="Uso" name="purpose" options={purposes.map((value) => ({ value, label: PURPOSE_LABELS[value] ?? value }))} defaultValue="principal" />
        </>
      )}
    </PanelAction>
  );
}

function DomainCard({ domain }: { domain: SiteDomain }) {
  const live = domain.status !== "retirado";
  return (
    <article className={`lift flex flex-col gap-3 rounded-tile border border-line bg-surface p-4 ${live ? "" : "opacity-60"}`}>
      <header className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <b className="block truncate font-mono text-[14px]">{domain.host}</b>
          <span className="text-[12px] text-fg-3">{PURPOSE_LABELS[domain.purpose] ?? domain.purpose}</span>
        </span>
        <VitrinaBadge status={domain.status} />
      </header>
      <div className="flex items-center gap-2 text-[12.5px]">
        <Lock size={14} className={domain.ssl_status === "emitido" ? "text-ok" : "text-fg-3"} />
        <span>SSL <VitrinaBadge status={domain.ssl_status} /></span>
        {domain.ssl_expires_at && <span className="text-fg-3">hasta {formatDate(domain.ssl_expires_at)} · renueva {domain.ssl_renews_on ? formatDate(domain.ssl_renews_on) : "—"}</span>}
      </div>
      {domain.status !== "verificado" && live && (
        <div className="flex flex-col gap-1.5">
          {domain.dns.map((record) => (
            <div key={record.type} className="grid grid-cols-[58px_1fr] items-start gap-2 text-[12px]">
              <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-center font-mono font-semibold">{record.type}</span>
              <span className="min-w-0 break-all font-mono text-fg-2">{record.name} <ArrowRight size={11} className="inline" /> {record.value}</span>
            </div>
          ))}
        </div>
      )}
      {domain.last_error && domain.status === "error" && <p className="flex gap-1.5 rounded-lg bg-[color-mix(in_srgb,var(--bad)_8%,var(--surface))] px-2.5 py-2 text-[12px] text-bad"><CircleAlert size={14} className="mt-px flex-none" />{domain.last_error}</p>}
      {live && (
        <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          <span className="text-[11.5px] text-fg-3">{domain.last_check_at ? `Revisado ${formatDateTime(domain.last_check_at)}` : "Sin revisar"}</span>
          <span className="flex gap-1.5">
            {domain.status !== "verificado" && <QuickAction id={`seo-verify-${domain.id}`} label="Verificar" title="Verificar DNS y emitir SSL" description={`${domain.host}. Revisamos el TXT y el CNAME; si están bien, emitimos el certificado.`} submitLabel="Verificar ahora" action={verifyDomain} fields={{ id: domain.id }} icon={<RefreshCw size={13} />} />}
            <QuickAction id={`seo-retire-${domain.id}`} label="Retirar" title="Retirar dominio" description={`${domain.host} deja de servir el sitio y queda libre para registrarse de nuevo.`} submitLabel="Retirar" action={retireDomain} fields={{ id: domain.id }} icon={<Ban size={13} />} tone="bad" />
          </span>
        </footer>
      )}
    </article>
  );
}

export function DomainsPanel({ domains }: { domains: DomainsOverview }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-[70ch] text-[13px] text-fg-2">1) Cree el registro TXT de verificación, 2) apunte el CNAME a sites.kipucontrol.com y 3) pulse Verificar. El certificado se renueva solo 30 días antes de vencer.</p>
        <AddDomainAction purposes={domains.purposes} />
      </div>
      {domains.items.length === 0 ? (
        <p className="rounded-tile border border-dashed border-line px-5 py-10 text-center text-[13.5px] text-fg-2">Aún no hay dominios propios. Su sitio funciona en {domains.fallback_host}.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{domains.items.map((domain) => <DomainCard key={domain.id} domain={domain} />)}</div>
      )}
    </div>
  );
}

function PageSeoAction({ page }: { page: SeoPage }) {
  const [indexable, setIndexable] = useState(page.indexable);
  return (
    <PanelAction<StepResult> label="Editar SEO" formId={`seo-page-${page.id}`} title={`SEO de ${page.path}`} description="Al guardar se recalcula el puntaje. El contenido de la página sigue en el CMS." submitLabel="Guardar" action={savePage} initial={initialStep} trigger={(open) => <QuickTrigger onClick={open} />}>
      {() => (
        <>
          <input type="hidden" name="id" value={page.id} />
          <input type="hidden" name="indexable" value={indexable ? "1" : "0"} />
          <TextField label="Título" name="title" required minLength={5} maxLength={120} defaultValue={page.title} hint="Ideal entre 30 y 60 caracteres." />
          <TextArea label="Meta descripción" name="meta_description" rows={3} maxLength={320} defaultValue={page.meta_description ?? undefined} hint="Ideal entre 70 y 160 caracteres." />
          <TextField label="Palabra clave principal" name="focus_keyword" maxLength={120} defaultValue={page.focus_keyword ?? undefined} />
          <TextField label="Datos estructurados" name="schema_types" defaultValue={page.schema_types.join(", ")} hint="Tipos de schema.org separados por coma: TouristTrip, Offer." />
          <TextField label="URL canónica" name="canonical_url" maxLength={400} defaultValue={page.canonical_url ?? undefined} />
          <SwitchField label="Indexable en buscadores" name="indexable_switch" checked={indexable} onCheckedChange={setIndexable} />
        </>
      )}
    </PanelAction>
  );
}

function QuickTrigger({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-8 items-center gap-1.5 rounded-[9px] bg-[color-mix(in_srgb,var(--violet)_12%,transparent)] px-2.5 text-[12.5px] font-semibold text-[var(--violet)] transition-transform duration-300 hover:-translate-y-0.5">Editar SEO</button>
  );
}

export function AuditPanel({ seo }: { seo: SeoOverview }) {
  const columns: Column<SeoPage>[] = [
    { id: "score", header: "Puntaje", cell: (row) => <ScoreRing value={row.score} /> },
    { id: "page", header: "Página", mobile: "title", cell: (row) => <span className="min-w-0"><b className="block truncate text-[13.5px] font-semibold">{row.title}</b><span className="font-mono text-[12px] text-fg-3">{row.path}</span></span> },
    { id: "keyword", header: "Palabra clave", wideOnly: true, cell: (row) => <span className="text-[13px]">{row.focus_keyword ?? <span className="text-warn">Sin definir</span>}</span> },
    { id: "issues", header: "Pendientes", cell: (row) => (row.issues.length === 0 ? <span className="text-[12.5px] font-semibold text-ok">Todo en orden</span> : <span className="flex flex-wrap gap-1">{row.issues.slice(0, 3).map((issue) => <span key={issue.code} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11.5px] text-fg-2">{issue.label}</span>)}{row.issues.length > 3 && <span className="text-[11.5px] text-fg-3" title={row.issues.slice(3).map((issue) => issue.label).join(" · ")}>+{row.issues.length - 3}</span>}</span>) },
    { id: "clicks", header: "Clics", align: "right", wideOnly: true, cell: (row) => <span className="font-mono text-[13px]">{formatNumber(row.clicks_28d)}</span> },
    { id: "position", header: "Posición", align: "right", wideOnly: true, cell: (row) => <span className="font-mono text-[13px]">{row.avg_position ?? "—"}</span> },
    { id: "actions", header: "", cell: (row) => <RowActions><PageSeoAction page={row} /></RowActions> },
  ];
  const metrics: MetricFilter<SeoPage>[] = [
    { id: "good", label: "Puntaje 80 o más", tone: "ok", icon: <ShieldCheck size={19} />, matches: (row) => (row.score ?? 0) >= 80 },
    { id: "issues", label: "Con pendientes", tone: "warn", icon: <CircleAlert size={19} />, matches: (row) => row.issues.length > 0 },
  ];
  const sorts: SortOption<SeoPage>[] = [
    { id: "score", label: "Puntaje", type: "number", value: (row) => row.score },
    { id: "clicks", label: "Clics", type: "number", value: (row) => row.clicks_28d },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-fg-2">La auditoría corre cada noche; reauditar ahora suma las historias publicadas del blog de aventuras.</p>
        <QuickAction id="seo-audit" label="Reauditar ahora" title="Reauditar el sitio" description="Recalcula el puntaje y los pendientes de cada página publicada." submitLabel="Reauditar" action={runAudit} icon={<RefreshCw size={13} />} />
      </div>
      <DataTable screen="canales-seo" rows={seo.items} columns={columns} getKey={(row) => row.id} entityLabel="páginas" searchText={(row) => `${row.path} ${row.title} ${row.focus_keyword ?? ""}`} searchPlaceholder="Buscar ruta, título o palabra clave" metrics={metrics} sorts={sorts} emptyTitle="Sin páginas auditadas" />
    </div>
  );
}

export function RedirectsPanel({ redirects }: { redirects: RedirectsOverview }) {
  const columns: Column<SiteRedirect>[] = [
    { id: "from", header: "Desde", mobile: "title", cell: (row) => <span className="font-mono text-[12.5px]">{row.from_path}</span> },
    { id: "to", header: "Hacia", cell: (row) => <span className="flex items-center gap-1.5 font-mono text-[12.5px]"><ArrowRight size={12} className="text-fg-3" />{row.to_path}</span> },
    { id: "code", header: "Código", cell: (row) => <span className="text-[13px]">{row.code === 301 ? "301 permanente" : "302 temporal"}</span> },
    { id: "hits", header: "Visitas", align: "right", cell: (row) => <span className="font-mono text-[13px]">{formatNumber(row.hits)}</span> },
    { id: "status", header: "Estado", mobile: "detail", cell: (row) => <VitrinaBadge status={row.active ? "activa" : "pausada"} label={row.active ? "Activa" : "Desactivada"} /> },
    { id: "actions", header: "", cell: (row) => (row.active ? <RowActions><QuickAction id={`seo-red-${row.id}`} label="Desactivar" title="Desactivar redirección" description={`${row.from_path} dejará de redirigir. El historial se conserva.`} submitLabel="Desactivar" action={disableRedirect} fields={{ id: row.id }} row="delete" /></RowActions> : null) },
  ];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-fg-2">Evite cadenas: si el destino ya redirige a otra página, apunte directo a la final.</p>
        <PanelAction<StepResult> label="Nueva redirección" icon={<Plus size={15} />} size="sm" formId="seo-redirect-new" title="Nueva redirección" submitLabel="Guardar" action={addRedirect} initial={initialStep}>
          {() => (
            <>
              <TextField label="Desde (ruta antigua)" name="from_path" required placeholder="/ruta-antigua" maxLength={300} />
              <TextField label="Hacia" name="to_path" required placeholder="/ruta-nueva" maxLength={400} />
              <SelectField label="Código" name="code" options={[{ value: "301", label: "301 permanente" }, { value: "302", label: "302 temporal" }]} defaultValue="301" />
            </>
          )}
        </PanelAction>
      </div>
      <DataTable screen="canales-seo-redirecciones" rows={redirects.items} columns={columns} getKey={(row) => row.id} entityLabel="redirecciones" searchText={(row) => `${row.from_path} ${row.to_path}`} searchPlaceholder="Buscar ruta" emptyTitle="Sin redirecciones" />
    </div>
  );
}

export function SitemapPanel({ seo }: { seo: SeoOverview }) {
  const xml = `<urlset>\n${seo.sitemap.urls.map((url) => `  <url><loc>${url}</loc></url>`).join("\n")}\n</urlset>`;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader title="sitemap.xml" subtitle={`${seo.sitemap.urls.length} URL · se regenera al publicar`} action={<Link2 size={16} className="text-fg-3" />} />
        <CodeSnippet code={xml} />
      </Card>
      <Card>
        <CardHeader title="robots.txt" subtitle={`Servido en https://${seo.sitemap.host}/robots.txt`} />
        <CodeSnippet code={seo.sitemap.robots} />
      </Card>
    </div>
  );
}

export function BrandTabs({ domains, seo, redirects }: { domains: DomainsOverview; seo: SeoOverview; redirects: RedirectsOverview }) {
  return (
    <TabCard
      tabs={[
        { id: "dominios", label: "Dominios y SSL", count: domains.kpis.total, content: <DomainsPanel domains={domains} /> },
        { id: "auditoria", label: "Auditoría por página", count: seo.kpis.pages, content: <AuditPanel seo={seo} /> },
        { id: "redirecciones", label: "Redirecciones", count: redirects.kpis.active, content: <RedirectsPanel redirects={redirects} /> },
        { id: "sitemap", label: "Sitemap y robots", content: <SitemapPanel seo={seo} /> },
      ]}
    />
  );
}
