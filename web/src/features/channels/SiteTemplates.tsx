"use client";

import { ArrowUpRight, Check, Clock3, Eye, Gauge, History, LayoutTemplate, Lock, Palette, RefreshCw, RotateCcw, ShoppingCart, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { applyTemplate, previewTemplate, purchaseTemplate, restoreTemplate, saveThemeTokens } from "@/app/(backoffice)/canales/plantillas/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { EmptyState } from "@/components/ui/EmptyState";
import { PanelAction } from "@/components/ui/PanelAction";
import { TintTile } from "@/components/ui/Tinted";
import { ColorRole } from "@/features/admin/Branding";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import { LIGHTHOUSE_LABELS, LIGHTHOUSE_MIN, sectionLabel, templatePrice, type GalleryTemplate, type Lighthouse, type SiteTemplate, type TemplateTokens, type ThemeOverview } from "@/lib/siteTemplates";
import { TileGrid } from "./ChannelUi";

const initial: StepResult = { message: null, done: false };

const FALLBACK: Required<Pick<TemplateTokens, "side" | "accent" | "sun" | "radius">> = { side: "#141a33", accent: "#b3263e", sun: "#f2b33d", radius: 12 };

function mix(hex: string, target: string, amount: number): string {
  const channels = (value: string) => [1, 3, 5].map((index) => parseInt(value.slice(index, index + 2), 16));
  const [a, b] = [channels(hex), channels(target)];
  return `#${a.map((value, index) => Math.round(value + (b[index] - value) * amount).toString(16).padStart(2, "0")).join("")}`;
}

export function TemplateMock({ tokens, big = false }: { tokens: TemplateTokens; big?: boolean }) {
  const side = tokens.side ?? FALLBACK.side;
  const accent = tokens.accent ?? FALLBACK.accent;
  const sun = tokens.sun ?? FALLBACK.sun;
  const radius = Math.min(tokens.radius ?? FALLBACK.radius, 14);

  return (
    <div aria-hidden className="overflow-hidden rounded-[12px] border border-line bg-white text-[0px] transition-transform duration-300 group-hover:-translate-y-0.5 dark:bg-[#1e1a16]">
      <div className="flex items-center gap-1.5 border-b border-line px-2.5 py-2">
        <i className="h-3.5 w-3.5 rounded-[4px]" style={{ background: side }} />
        <span className="h-1.5 w-7 rounded bg-line" />
        <span className="h-1.5 w-7 rounded bg-line" />
        <b className="ml-auto h-2.5 w-8 rounded-full" style={{ background: sun }} />
      </div>
      <div className={cn("flex flex-col gap-1.5 p-3", big ? "h-[120px]" : "h-[74px]")} style={{ background: `linear-gradient(140deg, ${side}, ${accent})` }}>
        <span className="h-2 w-3/5 rounded bg-white/90" />
        <span className="h-1.5 w-2/5 rounded bg-white/60" />
        <em className="mt-1 h-3 w-11 rounded-full" style={{ background: sun }} />
      </div>
      <div className="grid grid-cols-3 gap-2 p-2.5">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex flex-col gap-1 border border-line p-1.5" style={{ borderRadius: radius }}>
            <i className={big ? "h-11" : "h-7"} style={{ borderRadius: Math.max(0, radius - 3), background: `linear-gradient(135deg, ${mix(accent, "#ffffff", 0.25 + index * 0.15)}, ${side})` }} />
            <span className="h-1.5 w-4/5 rounded bg-line" />
            <b className="h-2 w-1/2 rounded" style={{ background: accent }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function LighthouseChips({ lighthouse }: { lighthouse: Lighthouse | null }) {
  if (!lighthouse) return null;
  if (!lighthouse.measured) return <p className="text-[12px] text-fg-3">Lighthouse pendiente de medición</p>;

  return (
    <div className="flex flex-wrap gap-1.5" title="Lighthouse móvil de la versión publicada">
      {(Object.keys(LIGHTHOUSE_MIN) as (keyof typeof LIGHTHOUSE_MIN)[]).map((key) => {
        const value = lighthouse[key];
        const ok = value !== null && value >= LIGHTHOUSE_MIN[key];
        return (
          <span key={key} className="rounded-md border border-line px-1.5 py-0.5 text-[11.5px] text-fg-2">
            {LIGHTHOUSE_LABELS[key].split(" ")[0]} <b className={ok ? "text-ok" : "text-warn"}>{value ?? "—"}</b>
          </span>
        );
      })}
    </div>
  );
}

function TierBadge({ template }: { template: SiteTemplate }) {
  return template.tier === "premium" ? <Badge tone="sun">{`Premium · ${templatePrice(template)}`}</Badge> : <Badge tone="ok">Incluida</Badge>;
}

export function SiteTemplateTiles({ theme, gallery }: { theme: ThemeOverview; gallery: GalleryTemplate[] }) {
  const active = theme.active;
  const available = gallery.filter((template) => template.available);
  const performance = active?.template.lighthouse;

  return (
    <TileGrid>
      <TintTile icon={Palette} tone="t1" label="Plantilla activa" value={active ? active.template.name : "Sin plantilla"} note={active ? `v${active.version} · ${active.chosen_by_label}` : undefined} info="El tema activo de su sitio público. Si nunca eligió una, su sitio usa la plantilla por defecto de KipuControl." />
      <TintTile icon={LayoutTemplate} tone="violet" label="Disponibles" value={`${available.length} de ${gallery.length}`} note={`${gallery.filter((template) => template.tier === "premium").length} premium · ${gallery.length - available.length} llegan pronto`} info="Plantillas publicadas en la galería. Las que aún no tienen diseño propio en el sitio aparecen como «Llega pronto»." />
      <TintTile icon={Gauge} tone={performance?.measured && (performance.performance ?? 0) >= 90 ? "ok" : "sun"} label="Rendimiento móvil" value={performance?.measured ? `${performance.performance} / 100` : "Por medir"} note="Lighthouse de la versión publicada" info="Puntaje Lighthouse móvil que el equipo registró al publicar la versión de su plantilla activa." />
      <TintTile icon={RefreshCw} tone={active?.update_available ? "sun" : "ok"} label="Actualización" value={active?.update_available ? `v${active.update_available}` : "Al día"} note={active?.update_available ? "Hay una versión nueva" : "Sin cambios pendientes"} info="Compara la versión que usa su sitio con la última publicada de la misma plantilla." />
    </TileGrid>
  );
}

function ApplyAction({ template, lockVersion, defaultOpen = false, label = "Aplicar" }: { template: GalleryTemplate | SiteTemplate; lockVersion: number; defaultOpen?: boolean; label?: string }) {
  return (
    <PanelAction<StepResult>
      label={label}
      icon={<Check size={15} />}
      variant="primary"
      size="sm"
      formId={`apply-${template.code}`}
      title={`Aplicar ${template.name}`}
      description="Su sitio cambia de presentación en cuanto confirme. Puede volver a la anterior desde el historial."
      submitLabel="Aplicar ahora"
      action={applyTemplate}
      initial={initial}
      defaultOpen={defaultOpen}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={template.code} />
          <input type="hidden" name="lock_version" value={lockVersion} />
          <TemplateMock tokens={template.tokens} big />
          <ul className="mt-4 flex flex-col gap-2 text-[13.5px] text-fg-2">
            <li className="flex gap-2"><Check size={16} className="mt-0.5 flex-none text-ok" />Sus tours, precios, reservas, blog, SEO, dominio y redirecciones no cambian.</li>
            <li className="flex gap-2"><Check size={16} className="mt-0.5 flex-none text-ok" />Conserva sus colores y textos; puede ajustarlos después en Personalizar.</li>
            <li className="flex gap-2"><Check size={16} className="mt-0.5 flex-none text-ok" />Secciones: {template.sections.map(sectionLabel).join(", ")}.</li>
          </ul>
        </>
      )}
    </PanelAction>
  );
}

function PurchaseAction({ template }: { template: GalleryTemplate }) {
  return (
    <PanelAction<StepResult>
      label="Comprar"
      icon={<ShoppingCart size={15} />}
      variant="primary"
      size="sm"
      formId={`purchase-${template.code}`}
      title={`Comprar ${template.name}`}
      description="Las plantillas premium son diseños de autor. Se pagan una sola vez y quedan disponibles mientras su cuenta esté activa, con sus actualizaciones."
      submitLabel={`Comprar por ${templatePrice(template)}`}
      action={purchaseTemplate}
      initial={initial}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={template.code} />
          <TemplateMock tokens={template.tokens} big />
          <dl className="mt-4 grid grid-cols-[120px_1fr] gap-y-2 text-[13.5px]">
            <dt className="text-fg-3">Precio</dt>
            <dd className="font-semibold">{templatePrice(template)} + IGV · pago único</dd>
            <dt className="text-fg-3">Autor</dt>
            <dd>{template.author.name}</dd>
            <dt className="text-fg-3">Se factura en</dt>
            <dd>Su próxima factura de KipuControl</dd>
          </dl>
        </>
      )}
    </PanelAction>
  );
}

function PreviewButton({ code }: { code: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <span className="inline-flex flex-col">
      <Button
        size="sm"
        icon={<Eye size={15} />}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await previewTemplate(code);
            if (result.done && result.path) router.push(result.path);
            else setError(result.message);
          })
        }
      >
        {pending ? "Preparando…" : "Vista previa"}
      </Button>
      {error && <small className="mt-1 text-[12px] text-bad">{error}</small>}
    </span>
  );
}

function CustomizeAction({ theme }: { theme: ThemeOverview }) {
  const [side, setSide] = useState(theme.tokens.side);
  const [accent, setAccent] = useState(theme.tokens.accent);
  const [sun, setSun] = useState(theme.tokens.sun);
  const [radius, setRadius] = useState(String(theme.tokens.radius));
  const preset = theme.active?.template.tokens ?? {};
  const corners = Object.entries(theme.catalog.corner_px);

  return (
    <PanelAction<StepResult>
      label="Personalizar"
      icon={<Palette size={15} />}
      variant="primary"
      size="sm"
      formId="theme-tokens"
      title="Personalizar la plantilla"
      description={`Los botones y enlaces necesitan contraste de ${theme.catalog.min_contrast.toLocaleString("es-PE")}:1 o más sobre blanco. Más opciones en Personalización, pestaña Sitio web.`}
      submitLabel="Guardar"
      action={saveThemeTokens}
      initial={initial}
    >
      {() => (
        <>
          <input type="hidden" name="lock_version" value={theme.lock_version} />
          <input type="hidden" name="side" value={side} />
          <input type="hidden" name="accent" value={accent} />
          <input type="hidden" name="sun" value={sun} />
          <TemplateMock tokens={{ side, accent, sun, radius: Number(radius) }} big />
          <div className="mt-4 flex flex-col gap-3">
            <ColorRole role={{ key: "menu", label: "Color de marca", hint: "Cabecera, portada y pie del sitio.", presets: [...new Set([preset.side, "#141a33", "#0f2747", "#0f172a", "#14281f"].filter((value): value is string => Boolean(value)).map((value) => value.toLowerCase()))] }} value={side} onChange={setSide} disabled={false} />
            <ColorRole role={{ key: "brand", label: "Botones y enlaces", hint: "Reservar, cotizar y los enlaces del sitio.", presets: [...new Set([preset.accent, "#b3263e", "#0e5db5", "#0f766e", "#6d28d9"].filter((value): value is string => Boolean(value)).map((value) => value.toLowerCase()))] }} value={accent} onChange={setAccent} disabled={false} />
            <ColorRole role={{ key: "gold", label: "Acento", hint: "Acción principal de Andes Clásico y detalles destacados.", presets: [...new Set([preset.sun, "#f2b33d", "#f5c04a", "#e9a23b"].filter((value): value is string => Boolean(value)).map((value) => value.toLowerCase()))], ink: "#2a1e00" }} value={sun} onChange={setSun} disabled={false} />
            <ChoiceGroup label="Redondeo de tarjetas" name="radius" defaultValue={String(corners.find(([, px]) => px === Number(radius))?.[1] ?? 12)} onChange={setRadius} options={corners.map(([key, px]) => ({ value: String(px), label: key === "rectas" ? `Rectas · ${px} px` : key === "suaves" ? `Suaves · ${px} px` : `Muy redondeadas · ${px} px` }))} />
          </div>
        </>
      )}
    </PanelAction>
  );
}

function RestoreAction({ id, name }: { id: string; name: string }) {
  return (
    <PanelAction<StepResult>
      label="Restaurar"
      icon={<RotateCcw size={14} />}
      size="sm"
      formId={`restore-${id}`}
      title={`Restaurar ${name}`}
      description="Su sitio vuelve a esta plantilla con la personalización que tenía. La actual queda en el historial."
      submitLabel="Restaurar"
      action={restoreTemplate}
      initial={initial}
    >
      {() => <input type="hidden" name="id" value={id} />}
    </PanelAction>
  );
}

export function ActiveTheme({ theme }: { theme: ThemeOverview }) {
  const active = theme.active;
  if (!active) return null;
  const tokens = { ...active.template.tokens, side: theme.tokens.side, accent: theme.tokens.accent, sun: theme.tokens.sun, radius: theme.tokens.radius };
  const update = active.update_available ? { ...active.template, version: active.update_available } : null;

  return (
    <div className="mb-5 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader title="Su plantilla activa" subtitle={active.applied_at ? `Activa desde el ${formatDate(active.applied_at, "long")}` : undefined} />
        <div className="group grid items-start gap-4 sm:grid-cols-2">
          <TemplateMock tokens={tokens} big />
          <div className="flex flex-col gap-3">
            <div>
              <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
                {active.template.name} <TierBadge template={active.template} />
              </p>
              <p className="mt-1 text-[13px] text-fg-3">{active.template.description}</p>
            </div>
            <LighthouseChips lighthouse={active.template.lighthouse} />
            <p className="text-[12.5px] text-fg-3">Secciones: {active.template.sections.map(sectionLabel).join(" · ")}</p>
            <div className="flex flex-wrap gap-2">
              <CustomizeAction theme={theme} />
              {update && <ApplyAction template={update} lockVersion={theme.lock_version} label={`Actualizar a v${update.version}`} />}
              <Button size="sm" variant="ghost" href="/admin/personalizacion" icon={<ArrowUpRight size={15} />}>
                Más opciones
              </Button>
            </div>
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader title="Historial" subtitle="Puede volver a una plantilla anterior cuando quiera." />
        {theme.history.length === 0 ? (
          <EmptyState icon={<History size={20} />} title="Sin cambios de plantilla" description="Cuando aplique otra plantilla, la anterior aparecerá aquí para restaurarla." />
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {theme.history.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 transition-colors hover:bg-surface-2/60">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold">
                    {item.template?.name ?? "Plantilla retirada"} <span className="font-mono text-[12px] font-normal text-fg-3">v{item.version}</span>
                  </p>
                  <p className="text-[12px] text-fg-3">
                    {item.applied_at ? formatDate(item.applied_at) : "—"} → {item.until ? formatDate(item.until) : "—"} · {item.chosen_by_label}
                  </p>
                </div>
                {item.can_restore && item.template && <RestoreAction id={item.id} name={item.template.name} />}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function TemplateGallery({ gallery, theme, applyCode }: { gallery: GalleryTemplate[]; theme: ThemeOverview; applyCode?: string }) {
  const [category, setCategory] = useState("");
  const categories = useMemo(() => [...new Set(gallery.map((template) => template.category))], [gallery]);
  const shown = gallery.filter((template) => !category || template.category === category);

  return (
    <section aria-label="Galería" className="mb-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[17px] font-semibold tracking-tight">Galería</h2>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tipo">
          {[{ value: "", label: "Todas" }, ...categories.map((value) => ({ value, label: theme.catalog.categories[value] }))].map((option) => (
            <button key={option.value || "todas"} type="button" aria-pressed={category === option.value} onClick={() => setCategory(option.value)} className={cn("rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition hover:-translate-y-0.5", category === option.value ? "border-brand bg-brand text-brand-fg" : "border-line bg-surface text-fg-2")}>
              {option.label}
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <Card>
          <EmptyState icon={<LayoutTemplate size={20} />} title="No hay plantillas publicadas" description="El catálogo de KipuControl todavía no tiene plantillas de este tipo." />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((template) => (
            <article key={template.code} className={cn("lift group flex flex-col gap-3 rounded-card border bg-surface p-3.5 shadow-card", template.is_active ? "border-brand ring-1 ring-brand" : "border-line")}>
              <div className={cn(!template.available && "opacity-70 grayscale-[35%]")}>
                <TemplateMock tokens={template.tokens} />
              </div>
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-[15px] font-semibold">{template.name}</h3>
                <TierBadge template={template} />
              </div>
              <p className="text-[13px] text-fg-3">{template.description}</p>
              <div className="flex flex-wrap gap-1">
                {[...new Set([...template.tags, template.category_label])].map((tag) => (
                  <span key={tag} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11.5px] text-fg-2">
                    {tag}
                  </span>
                ))}
              </div>
              <LighthouseChips lighthouse={template.lighthouse} />
              <p className="text-[12px] text-fg-3">
                v{template.version} · {template.author.name}
                {template.min_plan ? ` · desde plan ${template.min_plan.name}` : ""}
              </p>
              <div className="mt-auto flex flex-wrap items-center gap-2">
                {!template.available ? (
                  <Badge tone="mute">
                    <Clock3 size={12} className="mr-1 inline" />
                    Llega pronto
                  </Badge>
                ) : (
                  <>
                    <PreviewButton code={template.code} />
                    {template.is_active ? (
                      <Badge tone="accent">Activa</Badge>
                    ) : !template.plan_allowed ? (
                      <Badge tone="mute">
                        <Lock size={12} className="mr-1 inline" />
                        Desde {template.min_plan?.name}
                      </Badge>
                    ) : !template.purchased ? (
                      <PurchaseAction template={template} />
                    ) : (
                      <ApplyAction template={template} lockVersion={theme.lock_version} defaultOpen={applyCode === template.code} />
                    )}
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <div className="mt-4 flex items-start gap-3 rounded-card border border-line bg-surface-2/60 px-4 py-3 text-[13px] text-fg-2">
        <Sparkles size={17} className="mt-0.5 flex-none text-[var(--violet)]" />
        <p>¿Quiere un diseño propio? El equipo de KipuControl o un estudio partner puede crear una plantilla exclusiva para su marca con el mismo contrato técnico. Las plantillas nuevas aparecen aquí cuando pasan la revisión de calidad.</p>
      </div>
    </section>
  );
}
