"use client";

import { Archive, BookOpen, Building2, CircleCheck, CircleX, Clock3, Coins, Eye, FileCheck2, LayoutTemplate, Pencil, Plus, RotateCcw, Send, Star, Upload, Wallet } from "lucide-react";
import { assignTenantTheme, changeTemplateState, decideSubmission, saveAiPack, saveTemplate, submitTemplateVersion } from "@/app/plataforma/(consola)/plantillas/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { EmptyState } from "@/components/ui/EmptyState";
import { PathSectionNav } from "@/components/ui/PathSectionNav";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { TintTile } from "@/components/ui/Tinted";
import { LighthouseChips, TemplateMock } from "@/features/channels/SiteTemplates";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { LIGHTHOUSE_LABELS, LIGHTHOUSE_MIN, SUBMISSION_TONE, TEMPLATE_STATUS_TONE, sectionLabel, templatePrice, type AiPack, type SiteTemplate, type TemplateAssignment, type TemplatesAdminOverview, type TemplateSubmission, type TemplateVersion } from "@/lib/siteTemplates";
import { ConsoleAction } from "./ConsoleAction";

type CatalogTemplate = SiteTemplate & { versions: TemplateVersion[] };

export function TemplatesKpis({ overview }: { overview: TemplatesAdminOverview }) {
  const { kpis } = overview;

  return (
    <section aria-label="Resumen" className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <TintTile icon={LayoutTemplate} tone="t1" label="Publicadas" value={kpis.published} note={`${kpis.available} con diseño en el sitio · ${kpis.total} en el catálogo`} info="Plantillas con estado publicado. Solo las que tienen diseño propio en el sitio se pueden previsualizar y aplicar." />
      <TintTile icon={Clock3} tone={kpis.pending_submissions ? "sun" : "ok"} label="En revisión" value={kpis.pending_submissions} note="Envíos recibidos o validando" info="Envíos de versiones del equipo o de partners que esperan validaciones y revisión visual." />
      <TintTile icon={Building2} tone="violet" label="Agencias con plantilla" value={kpis.agencies} note={`${kpis.agencies_self} la eligieron ellas mismas`} info="Agencias de la plataforma con su plantilla activa; las que nunca eligieron usan la plantilla por defecto." />
      <TintTile icon={Wallet} tone="ok" label="Ventas premium" value={formatMoney(kpis.premium_amount)} note={`${kpis.premium_sales} ${kpis.premium_sales === 1 ? "compra" : "compras"}`} info="Suma de las compras de plantillas premium registradas por las agencias. Las cortesías no cuentan." />
    </section>
  );
}

export function TemplatesNav({ overview, submissions }: { overview: TemplatesAdminOverview; submissions: number }) {
  return (
    <PathSectionNav
      label="Secciones de plantillas"
      testId="templates-nav"
      groups={[
        {
          title: "Plantillas web",
          items: [
            { href: "/plataforma/plantillas", label: "Catálogo", count: overview.kpis.total, icon: <LayoutTemplate size={16} /> },
            { href: "/plataforma/plantillas/envios", label: "Envíos a revisión", count: submissions, icon: <FileCheck2 size={16} /> },
            { href: "/plataforma/plantillas/agencias", label: "Por agencia", count: overview.assignments.length, icon: <Building2 size={16} /> },
            { href: "/plataforma/plantillas/paquetes", label: "Paquetes de IA", icon: <Coins size={16} /> },
            { href: "/plataforma/plantillas/desarrolladores", label: "Para desarrolladores", icon: <BookOpen size={16} /> },
          ],
        },
      ]}
    />
  );
}

export function TemplateFormAction({ template, overview }: { template?: CatalogTemplate; overview: TemplatesAdminOverview }) {
  return (
    <ConsoleAction
      id={template ? `template-${template.code}` : "template-new"}
      label={template ? "Editar" : "Nueva plantilla"}
      icon={template ? <Pencil size={15} /> : <Plus size={16} strokeWidth={2.4} />}
      rowTone={template ? "edit" : undefined}
      variant={template ? "secondary" : "primary"}
      title={template ? `Editar ${template.name}` : "Nueva plantilla"}
      description={template ? "El tipo y el precio rigen para las compras nuevas; quienes ya la tienen la conservan." : "Nace en borrador. Se publica cuando se aprueba su primer envío con las validaciones en verde."}
      submitLabel={template ? "Guardar cambios" : "Crear plantilla"}
      action={saveTemplate}
      fields={template ? { original: template.code } : {}}
    >
      {!template && <TextField label="Identificador" name="slug" required pattern="[a-z0-9]+(-[a-z0-9]+)*" maxLength={60} placeholder="puna-andina" hint="Minúsculas, números y guiones. Será la carpeta en kipu-site-templates." />}
      <TextField label="Nombre" name="name" required maxLength={80} defaultValue={template?.name ?? ""} />
      <TextArea label="Descripción" name="description" required maxLength={600} rows={3} defaultValue={template?.description ?? ""} />
      <SelectField label="Tipo de agencia" name="category" options={Object.entries(overview.catalog.categories).map(([value, label]) => ({ value, label }))} defaultValue={template?.category ?? "agencia"} />
      <ChoiceGroup label="Modalidad" name="tier" options={Object.entries(overview.catalog.tiers).map(([value, label]) => ({ value, label: value === "premium" ? `${label} (pago único)` : `${label} (sin costo)` }))} defaultValue={template?.tier ?? "incluida"} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Precio S/ (premium)" name="price_once" type="number" min={0} step="0.01" defaultValue={template && template.tier === "premium" ? template.price : ""} hint="Solo para premium." />
        <SelectField label="Plan mínimo" name="min_plan_code" options={[{ value: "", label: "Cualquiera" }, ...overview.plans.map((plan) => ({ value: plan.code, label: plan.name }))]} defaultValue={template?.min_plan?.code ?? ""} />
      </div>
      <TextField label="Etiquetas" name="tags" defaultValue={template?.tags.join(", ") ?? ""} hint="Separadas por comas, hasta 8." />
      {!template && (
        <>
          <ChoiceGroup label="Autor" name="author_kind" options={[{ value: "equipo", label: "Equipo KipuControl" }, { value: "partner", label: "Partner" }]} defaultValue="equipo" />
          <TextField label="Nombre del autor" name="author_name" required maxLength={120} defaultValue="Equipo KipuControl" />
          <TextField label="Repositorio" name="repo_url" type="url" maxLength={300} placeholder="https://" />
        </>
      )}
    </ConsoleAction>
  );
}

function StateAction({ template, change }: { template: CatalogTemplate; change: "default" | "retirado" | "publicado" }) {
  const copy = {
    default: { label: "Por defecto", icon: <Star size={15} />, title: `Usar ${template.name} por defecto`, description: "Las agencias nuevas que no elijan otra recibirán esta plantilla.", submit: "Marcar por defecto", tone: "neutral" as const },
    retirado: { label: "Retirar", icon: <Archive size={15} />, title: `Retirar ${template.name}`, description: `Deja de mostrarse en la galería. Las ${template.installs} agencias que la usan la conservan y pueden migrar cuando quieran.`, submit: "Retirar", tone: "delete" as const },
    publicado: { label: "Republicar", icon: <RotateCcw size={15} />, title: `Republicar ${template.name}`, description: "Vuelve a la galería con su última versión aprobada.", submit: "Republicar", tone: "neutral" as const },
  }[change];

  return <ConsoleAction id={`template-${change}-${template.code}`} label={copy.label} icon={copy.icon} rowTone={copy.tone} title={copy.title} description={copy.description} submitLabel={copy.submit} action={changeTemplateState} fields={{ code: template.code, change }} />;
}

export function TemplatesCatalog({ overview }: { overview: TemplatesAdminOverview }) {
  const columns: Column<CatalogTemplate>[] = [
    { id: "view", header: "Vista", wideOnly: true, cell: (template) => <div className="group w-[140px]"><TemplateMock tokens={template.tokens} /></div> },
    {
      id: "name",
      header: "Plantilla",
      mobile: "title",
      cell: (template) => (
        <span className="block min-w-[180px]">
          <b className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-semibold">
            {template.name}
            {template.is_default && <Badge tone="accent">Por defecto</Badge>}
            {!template.site_style && template.status === "publicado" && <Badge tone="mute">Sin diseño en el sitio</Badge>}
          </b>
          <small className="text-xs text-fg-3">
            {template.author.name} · {template.category_label}
            {template.min_plan ? ` · desde ${template.min_plan.name}` : ""}
          </small>
        </span>
      ),
    },
    { id: "tier", header: "Modalidad", cell: (template) => <Badge tone={template.tier === "premium" ? "sun" : "ok"}>{templatePrice(template)}</Badge> },
    { id: "version", header: "Versión", cell: (template) => <span className="font-mono text-[13px]">{template.version ?? "—"}</span> },
    { id: "lighthouse", header: "Lighthouse", wideOnly: true, cell: (template) => <LighthouseChips lighthouse={template.lighthouse} /> },
    { id: "installs", header: "Agencias", align: "right", cell: (template) => <span className="font-mono text-[13px]">{template.installs}</span> },
    { id: "status", header: "Estado", cell: (template) => <Badge tone={TEMPLATE_STATUS_TONE[template.status]}>{template.status_label}</Badge> },
    {
      id: "actions",
      header: "",
      mobile: "hidden",
      align: "right",
      cell: (template) => (
        <RowActions>
          <TemplateFormAction template={template} overview={overview} />
          {template.status === "publicado" && !template.is_default && template.tier === "incluida" && <StateAction template={template} change="default" />}
          {template.status === "publicado" && !template.is_default && <StateAction template={template} change="retirado" />}
          {template.status === "retirado" && <StateAction template={template} change="publicado" />}
        </RowActions>
      ),
    },
  ];
  const metrics: MetricFilter<CatalogTemplate>[] = [
    { id: "published", label: "Publicadas", tone: "ok", icon: <CircleCheck size={19} />, matches: (template) => template.status === "publicado" },
    { id: "review", label: "Borrador o en revisión", tone: "sun", icon: <Clock3 size={19} />, matches: (template) => template.status === "borrador" || template.status === "en_revision" },
    { id: "retired", label: "Retiradas", tone: "mute", icon: <Archive size={19} />, matches: (template) => template.status === "retirado" },
  ];
  const filters: FilterConfig<CatalogTemplate>[] = [
    { id: "category", label: "Tipo", options: Object.entries(overview.catalog.categories).map(([value, label]) => ({ value, label })), value: (template) => template.category },
    { id: "tier", label: "Modalidad", options: Object.entries(overview.catalog.tiers).map(([value, label]) => ({ value, label })), value: (template) => template.tier },
  ];

  return <DataTable screen="plataforma-plantillas" rows={overview.templates} columns={columns} getKey={(template) => template.code} entityLabel="plantillas" searchText={(template) => `${template.name} ${template.code} ${template.author.name}`} searchPlaceholder="Buscar plantilla" metrics={metrics} filters={filters} />;
}

function CheckRow({ label, value }: { label: string; value: string | undefined }) {
  const ok = value === "ok";
  const bad = value === "falla";
  return (
    <div className="flex items-start gap-2">
      {ok ? <CircleCheck size={16} className="mt-0.5 flex-none text-ok" /> : bad ? <CircleX size={16} className="mt-0.5 flex-none text-bad" /> : <Clock3 size={16} className="mt-0.5 flex-none text-fg-3" />}
      <span>
        <b className="block text-[13px] font-semibold">{label}</b>
        <small className="text-[12px] text-fg-3">{ok ? "Correcto" : bad ? "No cumple" : "Pendiente"}</small>
      </span>
    </div>
  );
}

function DecisionAction({ submission, decision }: { submission: TemplateSubmission; decision: "aprobar" | "rechazar" }) {
  const approve = decision === "aprobar";
  return (
    <ConsoleAction
      id={`submission-${decision}-${submission.code}`}
      label={approve ? "Aprobar y publicar" : "Rechazar"}
      icon={approve ? <CircleCheck size={15} /> : <CircleX size={15} />}
      variant={approve ? "primary" : "secondary"}
      size="sm"
      title={approve ? `Aprobar ${submission.template?.name} v${submission.version}` : `Rechazar ${submission.code}`}
      description={approve ? "La versión se publica en la galería de todas las agencias. Las que usan la plantilla reciben el aviso de actualización." : "El autor recibe el motivo para corregir y volver a enviar."}
      submitLabel={approve ? "Publicar" : "Rechazar"}
      action={decideSubmission}
      fields={{ code: submission.code, decision, ...(approve ? { visual_review: "1" } : {}) }}
    >
      {approve ? (
        <p className="rounded-[12px] bg-surface-2 px-3.5 py-3 text-[13px] text-fg-2">Confirmo la revisión visual a 360, 768 y 1280 px, en modo claro y oscuro.</p>
      ) : (
        <TextArea label="Motivo" name="reason" required minLength={10} maxLength={1000} rows={4} placeholder="Por ejemplo: el contraste del botón secundario es 3,1:1 y el mínimo es 4,5:1." />
      )}
    </ConsoleAction>
  );
}

export function SubmitVersionAction({ overview }: { overview: TemplatesAdminOverview }) {
  const reported = [
    { value: "ok", label: "Correcto" },
    { value: "falla", label: "No cumple" },
    { value: "pendiente", label: "Pendiente" },
  ];
  return (
    <ConsoleAction id="submission-new" label="Registrar envío" icon={<Upload size={16} />} variant="primary" title="Registrar envío" description="Normalmente lo crea kipu-tpl submit. Las validaciones de manifiesto, contraste e idiomas se calculan aquí; build, datos estructurados y seguridad vienen del reporte de kipu-tpl check." submitLabel="Enviar a revisión" action={submitTemplateVersion}>
      <SelectField label="Plantilla" name="template_code" options={overview.templates.filter((template) => template.status !== "retirado").map((template) => ({ value: template.code, label: template.name }))} defaultValue={overview.templates[0]?.code} searchable />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Versión" name="version" required pattern="[0-9]+\.[0-9]+\.[0-9]+" placeholder="1.5.0" />
        <TextField label="SHA-256 del paquete" name="bundle_sha256" required pattern="[0-9a-fA-F]{64}" />
      </div>
      <TextField label="Ruta del paquete" name="bundle_path" required placeholder="kipu-site-templates/inti-raymi/inti-raymi-1.5.0.tgz" />
      <TextArea label="Manifiesto (template.json)" name="manifest" required rows={6} className="font-mono" />
      <div className="grid grid-cols-2 gap-3">
        {(Object.keys(LIGHTHOUSE_MIN) as (keyof typeof LIGHTHOUSE_MIN)[]).map((key) => (
          <TextField key={key} label={`${LIGHTHOUSE_LABELS[key]} (mín. ${LIGHTHOUSE_MIN[key]})`} name={`lh_${key}`} type="number" min={0} max={100} />
        ))}
      </div>
      {[
        ["build", "Build y SSR"],
        ["datos_estructurados", "Datos estructurados"],
        ["seguridad", "Seguridad"],
      ].map(([name, label]) => (
        <ChoiceGroup key={name} label={label} name={name} options={reported} defaultValue="pendiente" />
      ))}
      <TextArea label="Cambios de la versión" name="changelog" rows={3} maxLength={4000} />
    </ConsoleAction>
  );
}

export function SubmissionsBoard({ submissions, overview }: { submissions: TemplateSubmission[]; overview: TemplatesAdminOverview }) {
  if (submissions.length === 0) {
    return (
      <Card>
        <EmptyState icon={<Send size={20} />} title="Sin envíos" description="Los envíos del equipo y de los partners aparecerán aquí con sus validaciones." />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {submissions.map((submission) => {
        const lighthouse = (submission.checks.lighthouse ?? {}) as Partial<Record<keyof typeof LIGHTHOUSE_MIN, number>>;
        const open = submission.status === "recibida" || submission.status === "validando";
        return (
          <Card key={submission.code}>
            <CardHeader
              title={`${submission.template?.name ?? "Plantilla"} v${submission.version}`}
              subtitle={`${submission.code} · ${submission.submitted_by} · ${formatDateTime(submission.created_at)}${submission.decided_at ? ` · decidido el ${formatDate(submission.decided_at)}${submission.reviewer ? ` por ${submission.reviewer}` : ""}` : ""}`}
              action={<Badge tone={SUBMISSION_TONE[submission.status]}>{submission.status_label}</Badge>}
            />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Object.entries(overview.catalog.checks).map(([key, label]) =>
                key === "lighthouse" ? (
                  <div key={key} className="flex items-start gap-2">
                    {submission.lighthouse_ok ? <CircleCheck size={16} className="mt-0.5 flex-none text-ok" /> : <CircleX size={16} className="mt-0.5 flex-none text-bad" />}
                    <span>
                      <b className="block text-[13px] font-semibold">{label}</b>
                      <small className="text-[12px] text-fg-3">
                        R {lighthouse.performance ?? "—"} · A {lighthouse.accessibility ?? "—"} · SEO {lighthouse.seo ?? "—"} · BP {lighthouse.best_practices ?? "—"}
                      </small>
                    </span>
                  </div>
                ) : (
                  <CheckRow key={key} label={label} value={typeof submission.checks[key] === "string" ? (submission.checks[key] as string) : undefined} />
                ),
              )}
            </div>
            {submission.reject_reason && <p className="mt-3 rounded-[12px] bg-bad/[0.08] px-3.5 py-3 text-[13px] text-bad">Motivo del rechazo: {submission.reject_reason}</p>}
            {open && (
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <DecisionAction submission={submission} decision="rechazar" />
                <DecisionAction submission={submission} decision="aprobar" />
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function AssignAction({ row, overview }: { row: TemplateAssignment; overview: TemplatesAdminOverview }) {
  const options = overview.templates.filter((template) => template.status === "publicado" && template.site_style).map((template) => ({ value: template.code, label: template.tier === "premium" ? `${template.name} (premium, cortesía)` : template.name }));
  return (
    <ConsoleAction id={`assign-${row.tenant.code}`} label="Asignar" icon={<LayoutTemplate size={15} />} rowTone="edit" title={`Asignar plantilla a ${row.tenant.name}`} description="La agencia puede cambiarla después desde su panel. Una premium asignada aquí queda como cortesía." submitLabel="Asignar" action={assignTenantTheme} fields={{ tenant: row.tenant.code }}>
      <SelectField label="Plantilla" name="template_code" options={options} defaultValue={row.template?.code ?? options[0]?.value} />
      <TextArea label="Nota para la agencia" name="note" maxLength={200} rows={3} />
    </ConsoleAction>
  );
}

export function AssignmentsTable({ overview }: { overview: TemplatesAdminOverview }) {
  const columns: Column<TemplateAssignment>[] = [
    {
      id: "tenant",
      header: "Agencia",
      mobile: "title",
      cell: (row) => (
        <span>
          <b className="block text-[13.5px] font-semibold">{row.tenant.name}</b>
          <small className="font-mono text-xs text-fg-3">{row.tenant.code}</small>
        </span>
      ),
    },
    { id: "template", header: "Plantilla", cell: (row) => <span className="text-[13px]">{row.template?.name ?? "—"}</span> },
    {
      id: "version",
      header: "Versión",
      cell: (row) => (
        <span className="flex flex-wrap items-center gap-1.5 font-mono text-[13px]">
          {row.version ?? "—"}
          {row.update_available && <Badge tone="sun">{`v${row.update_available} disponible`}</Badge>}
        </span>
      ),
    },
    { id: "chosen", header: "Elegida por", cell: (row) => <span className="text-[13px]">{row.chosen_by_label}</span> },
    { id: "since", header: "Desde", wideOnly: true, cell: (row) => <span className="text-[13px]">{row.applied_at ? formatDate(row.applied_at) : "—"}</span> },
    { id: "actions", header: "", mobile: "hidden", align: "right", cell: (row) => <RowActions><AssignAction row={row} overview={overview} /></RowActions> },
  ];
  const metrics: MetricFilter<TemplateAssignment>[] = [
    { id: "self", label: "Elegida por la agencia", tone: "violet", icon: <Eye size={19} />, matches: (row) => row.chosen_by === "agencia" },
    { id: "platform", label: "Asignada por la plataforma", tone: "t1", icon: <LayoutTemplate size={19} />, matches: (row) => row.chosen_by === "admin_plataforma" },
    { id: "update", label: "Con actualización", tone: "sun", icon: <RotateCcw size={19} />, matches: (row) => row.update_available !== null },
  ];

  return <DataTable screen="plataforma-plantillas-agencias" rows={overview.assignments} columns={columns} getKey={(row) => row.tenant.code} entityLabel="agencias" searchText={(row) => `${row.tenant.name} ${row.tenant.code} ${row.template?.name ?? ""}`} searchPlaceholder="Buscar agencia" metrics={metrics} />;
}

function PackAction({ pack }: { pack: AiPack }) {
  return (
    <ConsoleAction id={`pack-${pack.code}`} label="Editar" icon={<Pencil size={15} />} rowTone="edit" title={`Editar ${pack.name}`} description="El precio y los créditos rigen para las compras nuevas." submitLabel="Guardar" action={saveAiPack} fields={{ code: pack.code }}>
      <TextField label="Nombre" name="name" required maxLength={80} defaultValue={pack.name} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Precio S/" name="price" type="number" min={0} step="0.01" required defaultValue={pack.price} />
        <TextField label="Créditos" name="credits" type="number" min={1} required defaultValue={pack.credits} />
      </div>
      <ChoiceGroup label="Estado" name="active" options={[{ value: "1", label: "A la venta" }, { value: "0", label: "Pausado" }]} defaultValue={pack.active ? "1" : "0"} />
    </ConsoleAction>
  );
}

export function AiPacksTable({ packs }: { packs: AiPack[] }) {
  const columns: Column<AiPack>[] = [
    {
      id: "name",
      header: "Paquete",
      mobile: "title",
      cell: (pack) => (
        <span>
          <b className="block text-[13.5px] font-semibold">{pack.name}</b>
          <small className="font-mono text-xs text-fg-3">{pack.code}</small>
        </span>
      ),
    },
    { id: "kind", header: "Tipo", cell: (pack) => <span className="text-[13px]">{pack.is_plan ? `Plan de ${pack.kind_label.toLowerCase()}` : pack.kind_label}</span> },
    { id: "credits", header: "Créditos", align: "right", cell: (pack) => <span className="font-mono text-[13px]">{pack.credits}{pack.image_bonus ? ` + ${pack.image_bonus} img.` : ""}</span> },
    { id: "billing", header: "Cobro", cell: (pack) => <span className="text-[13px]">{pack.billing === "mensual" ? "Mensual" : "Pago único"}</span> },
    { id: "price", header: "Precio", align: "right", cell: (pack) => <span className="font-mono text-[13px]">{formatMoney(pack.price, pack.currency)}</span> },
    { id: "status", header: "Estado", cell: (pack) => <Badge tone={pack.active ? "ok" : "mute"}>{pack.active ? "A la venta" : "Pausado"}</Badge> },
    { id: "actions", header: "", mobile: "hidden", align: "right", cell: (pack) => <RowActions><PackAction pack={pack} /></RowActions> },
  ];
  const metrics: MetricFilter<AiPack>[] = [
    { id: "plans", label: "Planes mensuales", tone: "t1", icon: <Coins size={19} />, matches: (pack) => pack.is_plan },
    { id: "paused", label: "Pausados", tone: "mute", icon: <Archive size={19} />, matches: (pack) => !pack.active },
  ];

  return <DataTable screen="plataforma-paquetes-ia" rows={packs} columns={columns} getKey={(pack) => pack.code} entityLabel="paquetes" searchText={(pack) => `${pack.name} ${pack.code}`} searchPlaceholder="Buscar paquete" metrics={metrics} />;
}

const STEPS = [
  "Clonar kipu-site-templates y crear templates/<slug> desde _starter con pnpm kipu-tpl new.",
  "Declarar template.json y sus tokens. La plantilla solo recibe datos tipados de @kipu/site-sdk: no llama a la API.",
  "Implementar las 12 páginas obligatorias y las secciones declaradas, sin scripts externos.",
  "pnpm kipu-tpl dev la levanta con los datos demo; pnpm kipu-tpl check corre manifiesto, build, Lighthouse, axe, contraste, idiomas y JSON-LD.",
  "pnpm kipu-tpl submit empaqueta el .tgz con su SHA-256 y crea el envío que aparece en Envíos a revisión.",
  "Al aprobarse, la versión se publica en la galería: las menores se aplican solas y las mayores se ofrecen a cada agencia.",
];

const REQUIREMENTS = [
  ["Lighthouse móvil", "Rendimiento 85, accesibilidad 95, SEO 95 y buenas prácticas 90 como mínimo"],
  ["Web Vitals", "LCP de 2,5 s, CLS de 0,1 e INP de 200 ms como máximo en 4G simulada"],
  ["Peso", "JS inicial de hasta 170 KB gzip por página"],
  ["Accesibilidad", "WCAG 2.2 AA: contraste 4,5:1, foco visible, teclado y textos alternativos"],
  ["Responsive", "360, 768 y 1280 px sin scroll horizontal; objetivos táctiles de 40 px"],
  ["Modo oscuro", "Tokens claros y oscuros; respeta prefers-color-scheme"],
  ["Idiomas", "Sin textos fijos: todo desde es, en y pt"],
  ["Legal Perú", "Libro de Reclamaciones visible, privacidad (Ley 29733) y términos"],
];

export function DeveloperGuide({ overview }: { overview: TemplatesAdminOverview }) {
  const example = JSON.stringify(
    {
      id: "inti-raymi",
      name: "Inti Raymi",
      version: "1.4.0",
      kipu: "^2.9",
      category: "agencia",
      tier: "incluida",
      author: { name: "Equipo KipuControl" },
      tokens: { side: "#7E1526", accent: "#C8102E", soft: "#FBEDE6", sun: "#E3A33B", radius: 18, font: { display: "Plus Jakarta Sans", body: "Plus Jakarta Sans" } },
      sections: ["hero_buscador", "destinos", "mas_vendidos", "resenas", "aventuras", "blog"],
      pages: overview.catalog.pages,
      locales: ["es", "en", "pt"],
      darkMode: true,
    },
    null,
    2,
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader title="Cómo se construye una plantilla" subtitle="Detalle completo en la spec 23, sección 13." />
          <ol className="flex flex-col gap-2.5">
            {STEPS.map((step, index) => (
              <li key={step} className="flex gap-3 text-[13.5px]">
                <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-surface-2 font-mono text-[12px] font-semibold">{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </Card>
        <Card>
          <CardHeader title="Manifiesto de ejemplo" subtitle="template.schema.json valida este archivo." />
          <pre className="scroll-thin max-h-[380px] overflow-auto rounded-[12px] bg-surface-2 p-3.5 font-mono text-[12px] leading-relaxed">{example}</pre>
        </Card>
      </div>
      <Card>
        <CardHeader title="Requisitos para publicar" />
        <dl className="grid gap-x-6 gap-y-3 md:grid-cols-2">
          {REQUIREMENTS.map(([title, detail]) => (
            <div key={title} className="rounded-[12px] border border-line px-3.5 py-3 transition-colors hover:border-[color-mix(in_srgb,var(--accent)_35%,transparent)]">
              <dt className="text-[13px] font-semibold">{title}</dt>
              <dd className="text-[12.5px] text-fg-3">{detail}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-[12.5px] text-fg-3">Secciones disponibles en el SDK: {overview.catalog.sections.map(sectionLabel).join(", ")}.</p>
      </Card>
    </div>
  );
}
