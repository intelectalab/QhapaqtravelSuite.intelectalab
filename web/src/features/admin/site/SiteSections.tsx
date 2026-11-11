"use client";

import { ArrowDown, ArrowUp, ExternalLink, History, Plus, RotateCcw, Rocket, Search, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";
import { discardSiteDraft, publishSite, restoreSiteVersion } from "@/app/(backoffice)/admin/personalizacion/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { AuditTrail } from "@/features/admin/AdminParts";
import { ColorRole, type ColorRoleKey, type ColorRoleSpec } from "@/features/admin/Branding";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { AGENCY_TOKEN, CORNER_RADII, defaultText, FONT_STACK, TEXT_GROUPS, type SiteDesign, type SiteNavLinkId, type SitePromo, type SiteSectionId } from "@/lib/site-design";
import { SITE_FONT_VARIABLES } from "@/lib/site-fonts";
import { SITE_TEXT, type SiteLocale } from "@/lib/site-i18n";
import { CharCount, ImagePicker, OptionTile, OrderedToggles, Segmented } from "./SiteControls";
import type { SiteSectionKey } from "./sections";
import type { StudioContext } from "./SiteStudio";

const SITE_COLORS: ColorRoleSpec[] = [
  { key: "brand", label: "Color principal", hint: "Botones de reservar y cotizar, el logo y los enlaces activos del menú.", presets: ["#b3263e", "#9f1d4f", "#c2410c", "#0f766e", "#1d4ed8", "#6d28d9", "#1f2937"] },
  { key: "accent", label: "Color de acento", hint: "Enlaces, iconos, etiquetas y el brillo del encabezado.", presets: ["#26357a", "#1e40af", "#0e7490", "#2c7a66", "#7a5af8", "#b45309", "#be185d"] },
  { key: "menu", label: "Color oscuro", hint: "Fondo del encabezado de la portada, del aviso superior y del pie.", presets: ["#141a33", "#0f172a", "#1c1917", "#14281f", "#2a1430", "#1e293b", "#3b0d18"] },
];

const SECTION_HINTS: Record<SiteSectionId, string> = {
  destinations: "Hasta 6 destinos con sus tours.",
  featured: "Los productos marcados como destacados.",
  promos: "Tus banners propios, si hay alguno vigente.",
  offers: "Promociones del catálogo con fecha de cierre.",
  departures: "Salidas grupales con cupos.",
  reasons: "Cuatro tarjetas de confianza.",
  reviews: "Reseñas verificadas y de plataformas.",
  newsletter: "Formulario para suscribirse.",
};

const NAV_PATHS: Record<SiteNavLinkId, string> = {
  destinations: "/destinos",
  tours: "/tours?tipo=tours",
  packages: "/tours?tipo=paquetes",
  experiences: "/tours?tipo=experiencias",
  transfers: "/tours?tipo=traslados",
  offers: "/ofertas",
  tailored: "/viajes-a-medida",
  contact: "/contacto",
};

const OVERLAYS = [
  { value: "0", label: "Sin velo" },
  { value: "25", label: "Suave" },
  { value: "45", label: "Medio" },
  { value: "65", label: "Fuerte" },
];

export function SiteSectionForm({ section, studio }: { section: SiteSectionKey; studio: StudioContext }) {
  const forms: Record<SiteSectionKey, ReactNode> = {
    "sitio-estilo": <StyleForm studio={studio} />,
    "sitio-portada": <HeroForm studio={studio} />,
    "sitio-secciones": <SectionsForm studio={studio} />,
    "sitio-banners": <BannersForm studio={studio} />,
    "sitio-menu": <MenuForm studio={studio} />,
    "sitio-textos": <TextsForm studio={studio} />,
    "sitio-buscadores": <SeoForm studio={studio} />,
    "sitio-publicar": <PublishForm studio={studio} />,
  };
  return <div className={cn("grid grid-cols-[minmax(0,1fr)] gap-4", SITE_FONT_VARIABLES)}>{forms[section]}</div>;
}

function StyleForm({ studio }: { studio: StudioContext }) {
  const { design, change, data, errors } = studio;
  const { catalog } = data;
  const own = design.theme.colors === "propios";
  const fontHints: Record<string, string> = { moderna: "Limpia y actual", clasica: "Con serifas, elegante", redondeada: "Cercana y amable", editorial: "De revista de viajes" };

  return (
    <>
      <Card>
        <CardHeader title="Colores del sitio" subtitle="Usa los mismos colores del panel o elige una paleta propia para tus clientes." />
        <Segmented
          label="Origen de los colores"
          value={design.theme.colors}
          options={catalog.color_sources}
          testId="site-colors-source"
          onChange={(value) =>
            change((draft) => {
              if (value === "propios" && draft.theme.colors === "panel") Object.assign(draft.theme, data.panel_colors);
              draft.theme.colors = value;
            })
          }
        />
        {own ? (
          <div className="mt-4 grid gap-3">
            {SITE_COLORS.map((role) => (
              <div key={role.key}>
                <ColorRole role={role} value={design.theme[role.key]} disabled={false} onChange={(value) => change((draft) => void (draft.theme[role.key as ColorRoleKey] = value))} />
                {errors[`theme.${role.key}`] && <p className="mt-1 text-[12px] font-semibold text-bad">{errors[`theme.${role.key}`]}</p>}
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-3 rounded-[14px] border border-line p-3">
            <span className="flex -space-x-2">
              {(["brand", "accent", "menu"] as const).map((key) => (
                <span key={key} className="h-8 w-8 rounded-full border-2 border-surface" style={{ background: data.panel_colors[key] }} />
              ))}
            </span>
            <span className="min-w-0 flex-1 text-[12.5px] text-fg-3">El sitio usa los colores del panel. Si los cambias allá, el sitio cambia contigo.</span>
            <Link href="/admin/personalizacion?seccion=panel" className="text-[12.5px] font-semibold text-accent">
              Ir a colores del panel
            </Link>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Tipografía" subtitle="La letra de todo el sitio: títulos, textos y botones." />
        <div role="radiogroup" aria-label="Tipografía" className="grid grid-cols-2 gap-2">
          {catalog.fonts.map((font) => (
            <OptionTile key={font.value} selected={design.theme.font === font.value} onClick={() => change((draft) => void (draft.theme.font = font.value))} title={font.label} hint={fontHints[font.value]} testId={`site-font:${font.value}`}>
              <span className="text-[26px] font-semibold leading-none tracking-tight text-fg" style={{ fontFamily: FONT_STACK[font.value] }}>
                Aa Cusco
              </span>
            </OptionTile>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Esquinas" subtitle="Qué tan redondeadas se ven las tarjetas, botones y campos." />
        <div role="radiogroup" aria-label="Esquinas" className="grid grid-cols-3 gap-2">
          {catalog.corners.map((corner) => (
            <OptionTile key={corner.value} selected={design.theme.corners === corner.value} onClick={() => change((draft) => void (draft.theme.corners = corner.value))} title={corner.label} testId={`site-corners:${corner.value}`}>
              <span className="flex h-12 items-end gap-1.5">
                <span className="h-12 w-12 border-2 border-accent/60 bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]" style={{ borderRadius: CORNER_RADII[corner.value].card }} />
                <span className="h-5 w-10 bg-brand" style={{ borderRadius: CORNER_RADII[corner.value].control }} />
              </span>
            </OptionTile>
          ))}
        </div>
      </Card>
    </>
  );
}

function HeroForm({ studio }: { studio: StudioContext }) {
  const { design, change, data, errors, imageHref } = studio;
  const { hero } = design;
  const swatch: Record<SiteDesign["hero"]["style"], string> = {
    noche: "bg-[radial-gradient(120px_60px_at_80%_0%,color-mix(in_srgb,var(--accent)_70%,transparent),transparent),radial-gradient(100px_60px_at_0%_100%,color-mix(in_srgb,var(--brand)_55%,transparent),transparent)] bg-[#141a33]",
    color: "bg-[#141a33]",
    imagen: "bg-[linear-gradient(135deg,#5b7553,#c69c6d_55%,#7a8fa6)]",
  };

  return (
    <>
      <Card>
        <CardHeader title="Fondo del encabezado" subtitle="Lo primero que ve el visitante al entrar a tu sitio." />
        <div role="radiogroup" aria-label="Fondo del encabezado" className="grid grid-cols-3 gap-2">
          {data.catalog.hero_styles.map((style) => (
            <OptionTile key={style.value} selected={hero.style === style.value} onClick={() => change((draft) => void (draft.hero.style = style.value))} title={style.label} testId={`site-hero-style:${style.value}`}>
              <span className={cn("h-14 rounded-[10px]", swatch[style.value])} />
            </OptionTile>
          ))}
        </div>
        {hero.style === "imagen" && (
          <div className="mt-4 grid gap-4">
            <ImagePicker
              label="Imagen de la portada"
              value={hero.image_id}
              onChange={(id) => change((draft) => void (draft.hero.image_id = id))}
              images={data.images}
              onImagesChange={(images) => studio.setData({ ...data, images })}
              imageHref={imageHref}
              testId="site-hero-image"
            />
            {errors["hero.image_id"] && <p className="-mt-2 text-[12px] font-semibold text-bad">{errors["hero.image_id"]}</p>}
            <Segmented label="Velo oscuro sobre la imagen" hint="Ayuda a que el título se lea bien sobre fotos claras." value={String(hero.overlay)} options={OVERLAYS.some((item) => item.value === String(hero.overlay)) ? OVERLAYS : [...OVERLAYS, { value: String(hero.overlay), label: `${hero.overlay} %` }]} onChange={(value) => change((draft) => void (draft.hero.overlay = Number(value)))} testId="site-hero-overlay" />
          </div>
        )}
      </Card>

      <Card>
        <CardHeader title="Contenido del encabezado" subtitle="Textos, alineación y lo que acompaña al título." />
        <div className="grid gap-4">
          <OverrideField studio={studio} locale="es" item={{ key: "home.heroTitle", label: "Título principal" }} />
          <OverrideField studio={studio} locale="es" item={{ key: "home.heroBody", label: "Texto bajo el título", long: true }} />
          <Segmented label="Alineación" value={hero.align} options={data.catalog.hero_align} onChange={(value) => change((draft) => void (draft.hero.align = value))} testId="site-hero-align" />
          <SwitchField label="Mostrar el buscador de tours" hint="Destino, fecha y viajeros, directo en la portada." name="show_search" checked={hero.show_search} onCheckedChange={(checked) => change((draft) => void (draft.hero.show_search = checked))} />
          <SwitchField label="Mostrar las cifras del catálogo" hint="Cuántos productos, destinos y salidas tienes publicados." name="show_stats" checked={hero.show_stats} onCheckedChange={(checked) => change((draft) => void (draft.hero.show_stats = checked))} />
          <p className="text-[12.5px] text-fg-3">
            Para escribir estos textos en inglés, ve a <Link href="/admin/personalizacion?seccion=sitio-textos" className="font-semibold text-accent">Textos</Link>.
          </p>
        </div>
      </Card>
    </>
  );
}

function SectionsForm({ studio }: { studio: StudioContext }) {
  const { design, change, data } = studio;
  const labels = Object.fromEntries(data.catalog.sections.map((item) => [item.value, item.label])) as Record<SiteSectionId, string>;
  const hidden = design.sections.filter((section) => !section.visible).length;
  return (
    <Card>
      <CardHeader
        title="Orden de las secciones de la portada"
        subtitle={hidden === 0 ? "Todas las secciones están visibles. Súbelas o bájalas para cambiar el orden." : `${hidden === 1 ? "1 sección oculta" : `${hidden} secciones ocultas`}. Súbelas o bájalas para cambiar el orden.`}
        action={<InfoTip>Si una sección no tiene contenido, por ejemplo cuando no hay ofertas vigentes, no aparece aunque esté visible.</InfoTip>}
      />
      <OrderedToggles items={design.sections} labels={labels} hints={SECTION_HINTS} testId="site-sections" onChange={(items) => change((draft) => void (draft.sections = items))} />
    </Card>
  );
}

function promoState(promo: SitePromo): { label: string; tone: "ok" | "warn" | "mute" } {
  const today = new Date().toISOString().slice(0, 10);
  if (!promo.visible) return { label: "Oculto", tone: "mute" };
  if (promo.starts_on && promo.starts_on > today) return { label: "Programado", tone: "warn" };
  if (promo.ends_on && promo.ends_on < today) return { label: "Vencido", tone: "mute" };
  return { label: "Visible ahora", tone: "ok" };
}

function BannersForm({ studio }: { studio: StudioContext }) {
  const { design, change, data, errors, imageHref } = studio;
  const { announcement, promos } = design;
  const max = data.catalog.max_promos;

  const addPromo = () =>
    change((draft) => {
      draft.promos.push({ id: `promo-${Date.now().toString(36)}`, title: "Nueva promoción", body: "", image_id: null, cta_label: "Ver ofertas", cta_href: "/ofertas", tone: "marca", starts_on: null, ends_on: null, visible: true });
      const index = draft.sections.findIndex((section) => section.id === "promos");
      if (index >= 0) draft.sections[index].visible = true;
    });

  const movePromo = (index: number, delta: number) =>
    change((draft) => {
      const [item] = draft.promos.splice(index, 1);
      draft.promos.splice(index + delta, 0, item);
    });

  return (
    <>
      <Card>
        <CardHeader title="Aviso superior" subtitle="La franja delgada sobre el menú, en todas las páginas del sitio." />
        <div className="grid gap-4">
          <Segmented label="Qué mostrar" value={announcement.mode} options={data.catalog.announcement_modes.map((mode) => ({ ...mode, label: { cms: "Banner del CMS", propio: "Aviso propio", oculto: "Nada" }[mode.value] }))} onChange={(value) => change((draft) => void (draft.announcement.mode = value))} testId="site-announcement-mode" />
          {announcement.mode === "cms" && (
            <p className="text-[12.5px] text-fg-3">
              Se muestra el banner vigente publicado para el canal Web en <Link href="/canales/cms" className="font-semibold text-accent">CMS</Link>. Si no hay ninguno, no aparece la franja.
            </p>
          )}
          {announcement.mode === "propio" && (
            <>
              <TextField label="Texto del aviso" name="announcement_text" value={announcement.text} maxLength={140} onChange={(event) => change((draft) => void (draft.announcement.text = event.target.value))} error={errors["announcement.text"]} hint={<CharCount value={announcement.text} max={140} />} placeholder="Feriado largo: 10 % de descuento en tours a Cusco" />
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField label="Texto del enlace" name="announcement_link_label" value={announcement.link_label} maxLength={40} onChange={(event) => change((draft) => void (draft.announcement.link_label = event.target.value))} error={errors["announcement.link_label"]} placeholder="Ver ofertas" />
                <TextField label="A dónde lleva" name="announcement_link_href" value={announcement.link_href} maxLength={200} onChange={(event) => change((draft) => void (draft.announcement.link_href = event.target.value))} error={errors["announcement.link_href"]} placeholder="/ofertas" />
              </div>
            </>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Banners promocionales"
          subtitle={promos.length === 0 ? "Tarjetas grandes en la portada para campañas, temporadas o productos estrella." : `${promos.length} de ${max} banners. Se muestran en la portada, en la posición de la sección «Banners promocionales».`}
          action={
            <Button size="sm" icon={<Plus size={14} />} onClick={addPromo} disabled={promos.length >= max} data-testid="site-promo-add">
              Agregar
            </Button>
          }
        />
        {errors.promos && <p className="mb-3 text-[12.5px] font-semibold text-bad">{errors.promos}</p>}
        <div className="grid gap-3">
          {promos.map((promo, index) => {
            const state = promoState(promo);
            const field = (name: string) => errors[`promos.${index}.${name}`];
            const set = (recipe: (item: SitePromo) => void) => change((draft) => recipe(draft.promos[index]));
            return (
              <details key={promo.id} open={index === promos.length - 1} className="group rounded-[16px] border border-line bg-surface open:shadow-card" data-testid={`site-promo:${index}`}>
                <summary className="flex cursor-pointer list-none items-center gap-3 px-3.5 py-3">
                  <span className={cn("h-10 w-14 flex-none rounded-[10px] bg-cover bg-center", !promo.image_id && { marca: "bg-brand", acento: "bg-accent", menu: "bg-menu" }[promo.tone])} style={promo.image_id ? { backgroundImage: `url(${imageHref(promo.image_id)})` } : undefined} />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-[13.5px] font-semibold">{promo.title || "Sin título"}</b>
                    <span className="block truncate text-[12px] text-fg-3">{promo.starts_on || promo.ends_on ? `${promo.starts_on ?? "Ya"} → ${promo.ends_on ?? "sin fin"}` : "Sin fechas: se muestra siempre"}</span>
                  </span>
                  <Badge tone={state.tone}>{state.label}</Badge>
                </summary>
                <div className="grid gap-3.5 border-t border-line px-3.5 pb-4 pt-3.5">
                  <TextField label="Título" name={`promo_${index}_title`} value={promo.title} maxLength={80} onChange={(event) => set((item) => void (item.title = event.target.value))} error={field("title")} hint={<CharCount value={promo.title} max={80} />} />
                  <TextArea label="Texto" name={`promo_${index}_body`} rows={2} value={promo.body} maxLength={200} onChange={(event) => set((item) => void (item.body = event.target.value))} error={field("body")} />
                  <ImagePicker label="Imagen de fondo (opcional)" hint="Sin imagen, el banner usa el color elegido abajo." value={promo.image_id} onChange={(id) => set((item) => void (item.image_id = id))} images={data.images} onImagesChange={(images) => studio.setData({ ...data, images })} imageHref={imageHref} testId={`site-promo-image:${index}`} />
                  <Segmented label="Color" value={promo.tone} options={data.catalog.promo_tones} onChange={(value) => set((item) => void (item.tone = value))} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TextField label="Texto del botón" name={`promo_${index}_cta_label`} value={promo.cta_label} maxLength={30} onChange={(event) => set((item) => void (item.cta_label = event.target.value))} error={field("cta_label")} placeholder="Reservar ahora" />
                    <TextField label="A dónde lleva" name={`promo_${index}_cta_href`} value={promo.cta_href} maxLength={200} onChange={(event) => set((item) => void (item.cta_href = event.target.value))} error={field("cta_href")} placeholder="/tours/machu-picchu" />
                    <TextField label="Desde" name={`promo_${index}_starts_on`} type="date" value={promo.starts_on ?? ""} onChange={(event) => set((item) => void (item.starts_on = event.target.value || null))} error={field("starts_on")} />
                    <TextField label="Hasta" name={`promo_${index}_ends_on`} type="date" value={promo.ends_on ?? ""} onChange={(event) => set((item) => void (item.ends_on = event.target.value || null))} error={field("ends_on")} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <SwitchField label="Visible" name={`promo_${index}_visible`} checked={promo.visible} onCheckedChange={(checked) => set((item) => void (item.visible = checked))} />
                    <span className="ml-auto flex items-center gap-1">
                      <Button size="sm" variant="ghost" iconOnly label="Subir" icon={<ArrowUp size={14} />} disabled={index === 0} onClick={() => movePromo(index, -1)} />
                      <Button size="sm" variant="ghost" iconOnly label="Bajar" icon={<ArrowDown size={14} />} disabled={index === promos.length - 1} onClick={() => movePromo(index, 1)} />
                      <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => change((draft) => void draft.promos.splice(index, 1))} data-testid={`site-promo-remove:${index}`}>
                        Quitar
                      </Button>
                    </span>
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      </Card>
    </>
  );
}

function MenuForm({ studio }: { studio: StudioContext }) {
  const { design, change, data, errors } = studio;
  const custom = design.texts.es ?? {};
  const labels = Object.fromEntries(data.catalog.nav_links.map((item) => [item.value, custom[`header.links.${item.value}`] || item.label])) as Record<SiteNavLinkId, string>;
  const toggles: { key: keyof Omit<SiteDesign["nav"], "links">; label: string; hint: string }[] = [
    { key: "show_quote", label: "Botón para cotizar", hint: "Lleva al formulario de viajes a medida." },
    { key: "show_cart", label: "Carrito", hint: "Apágalo si no vendes en línea." },
    { key: "show_locale", label: "Cambio de idioma", hint: "Español e inglés." },
    { key: "show_theme", label: "Modo claro y oscuro", hint: "El visitante elige cómo ver el sitio." },
  ];
  return (
    <>
      <Card>
        <CardHeader title="Enlaces del menú" subtitle="Ordénalos o escóndelos. Para cambiarles el nombre ve a Textos." />
        <OrderedToggles items={design.nav.links} labels={labels} hints={NAV_PATHS} testId="site-nav-links" onChange={(items) => change((draft) => void (draft.nav.links = items))} />
      </Card>
      <Card>
        <CardHeader title="Botones de la cabecera" />
        <div className="grid gap-3.5">
          {toggles.map((toggle) => (
            <SwitchField key={toggle.key} label={toggle.label} hint={toggle.hint} name={toggle.key} checked={design.nav[toggle.key]} onCheckedChange={(checked) => change((draft) => void (draft.nav[toggle.key] = checked))} />
          ))}
        </div>
      </Card>
      <Card>
        <CardHeader title="Pie de página" subtitle="El Libro de Reclamaciones y los datos legales siempre se muestran: son obligatorios." />
        <div className="grid gap-3.5">
          <SwitchField label="Mostrar las sedes" hint="Nombre y dirección de cada sede activa." name="show_sedes" checked={design.footer.show_sedes} onCheckedChange={(checked) => change((draft) => void (draft.footer.show_sedes = checked))} />
          <SwitchField label="Mostrar el tipo de cambio" hint="El dólar del día, útil si vendes en soles y dólares." name="show_fx" checked={design.footer.show_fx} onCheckedChange={(checked) => change((draft) => void (draft.footer.show_fx = checked))} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Redes sociales" subtitle="Solo aparecen las que completes. Pega el enlace completo, empezando con https://." />
        <div className="grid gap-3">
          {data.catalog.social.map((network) => (
            <TextField key={network.value} label={network.label} name={`social_${network.value}`} value={design.footer.social[network.value]} maxLength={200} placeholder={network.value === "whatsapp" ? "https://wa.me/51999999999" : `https://${network.value}.com/tu-agencia`} onChange={(event) => change((draft) => void (draft.footer.social[network.value] = event.target.value.trim()))} error={errors[`footer.social.${network.value}`]} />
          ))}
        </div>
      </Card>
    </>
  );
}

function OverrideField({ studio, locale, item }: { studio: StudioContext; locale: SiteLocale; item: { key: string; label: string; long?: boolean } }) {
  const { design, change, data, errors } = studio;
  const max = data.catalog.texts.find((text) => text.key === item.key)?.max ?? 200;
  const value = design.texts[locale]?.[item.key] ?? "";
  const placeholder = defaultText(SITE_TEXT[locale], item.key);
  const set = (next: string) =>
    change((draft) => {
      const texts = { ...(draft.texts[locale] ?? {}) };
      if (next === "") delete texts[item.key];
      else texts[item.key] = next;
      draft.texts[locale] = texts;
    });
  const error = errors[`texts.${locale}.${item.key}`];
  const hint = (
    <span className="flex items-center gap-2">
      <CharCount value={value} max={max} />
      {value !== "" && (
        <button type="button" onClick={() => set("")} className="inline-flex items-center gap-1 font-semibold text-accent">
          <Undo2 size={12} /> Usar el texto original
        </button>
      )}
    </span>
  );
  const props = { label: item.label, name: `text_${locale}_${item.key}`, value, placeholder, maxLength: max, error, hint };
  return item.long ? <TextArea {...props} rows={3} onChange={(event) => set(event.target.value)} /> : <TextField {...props} onChange={(event) => set(event.target.value)} />;
}

function TextsForm({ studio }: { studio: StudioContext }) {
  const [locale, setLocale] = useState<SiteLocale>("es");
  const [query, setQuery] = useState("");
  const texts = studio.design.texts[locale] ?? {};
  const changed = Object.keys(texts).length;
  const wanted = query.trim().toLowerCase();
  const groups = TEXT_GROUPS.map((group) => ({ ...group, keys: group.keys.filter((item) => !wanted || `${group.title} ${item.label} ${texts[item.key] ?? ""} ${defaultText(SITE_TEXT[locale], item.key)}`.toLowerCase().includes(wanted)) })).filter((group) => group.keys.length > 0);

  return (
    <>
      <Card>
        <CardHeader title="Textos del sitio" subtitle={changed === 0 ? "Todos los textos son los originales. Escribe solo los que quieras cambiar; el resto se queda igual." : `${changed === 1 ? "1 texto personalizado" : `${changed} textos personalizados`} en ${locale === "es" ? "español" : "inglés"}.`} />
        <div className="grid gap-3">
          <Segmented label="Idioma" value={locale} options={[{ value: "es", label: "Español" }, { value: "en", label: "Inglés" }]} onChange={setLocale} testId="site-texts-locale" />
          <TextField label="Buscar un texto" name="text_search" icon={<Search size={16} />} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Título, ofertas, pie…" />
          <p className="text-[12.5px] text-fg-3">El texto gris es el original. Usa {AGENCY_TOKEN} para insertar el nombre de tu agencia.</p>
        </div>
      </Card>
      {groups.map((group) => (
        <Card key={group.title}>
          <CardHeader title={group.title} subtitle={group.hint} />
          <div className="grid gap-3.5">
            {group.keys.map((item) => (
              <OverrideField key={`${locale}-${item.key}`} studio={studio} locale={locale} item={item} />
            ))}
          </div>
        </Card>
      ))}
      {groups.length === 0 && <p className="px-1 text-[13px] text-fg-3">Ningún texto coincide con «{query.trim()}».</p>}
    </>
  );
}

function SeoForm({ studio }: { studio: StudioContext }) {
  const { design, change, data, errors } = studio;
  const name = data.site.name;
  const title = design.seo.title || `${name} · ${defaultText(SITE_TEXT.es, "header.tagline")}`;
  const description = design.seo.description || "Tours, paquetes y experiencias con precio por fecha y reserva en línea.";
  return (
    <>
      <Card>
        <CardHeader title="Cómo te ven en Google" subtitle="El título y la descripción que muestran los buscadores y las redes cuando alguien comparte tu sitio." />
        <div className="grid gap-4">
          <TextField label="Título" name="seo_title" value={design.seo.title} maxLength={70} placeholder={title} onChange={(event) => change((draft) => void (draft.seo.title = event.target.value))} error={errors["seo.title"]} hint={<CharCount value={design.seo.title} max={70} />} />
          <TextArea label="Descripción" name="seo_description" rows={3} value={design.seo.description} maxLength={160} placeholder={description} onChange={(event) => change((draft) => void (draft.seo.description = event.target.value))} error={errors["seo.description"]} hint={<CharCount value={design.seo.description} max={160} />} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Así se vería en el buscador" />
        <div className="rounded-[14px] border border-line bg-white p-4 text-left font-[Arial,sans-serif] dark:bg-surface-2" data-testid="site-seo-preview">
          <p className="truncate text-[12px] text-[#4d5156] dark:text-fg-3">{data.site.subdomain}.kipucontrol.com</p>
          <p className="mt-0.5 truncate text-[18px] leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">{title}</p>
          <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-[#4d5156] dark:text-fg-2">{description}</p>
        </div>
      </Card>
    </>
  );
}

function PublishForm({ studio }: { studio: StudioContext }) {
  const { data, pending, load, status } = studio;
  const [note, setNote] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, start] = useTransition();
  const home = `/sitio/${data.site.subdomain}`;
  const busySaving = status === "saving" || status === "dirty";

  const run = (action: () => Promise<{ ok: true; overview: typeof data; message: string } | { ok: false; message: string }>, after?: () => void) =>
    start(async () => {
      const result = await action();
      if (result.ok) {
        load(result.overview);
        after?.();
      }
      setFeedback({ ok: result.ok, text: result.message });
    });

  return (
    <>
      <Card>
        <CardHeader title={pending.length === 0 ? "Tu sitio está al día" : "Cambios listos para publicar"} subtitle={data.published_at ? `Última publicación: versión ${data.published_version}, ${formatDateTime(data.published_at)}.` : "Aún no publicas cambios: tus clientes ven el diseño original."} />
        {pending.length > 0 && (
          <ul className="mb-4 flex flex-wrap gap-1.5" data-testid="site-pending">
            {pending.map((area) => (
              <li key={area} className="rounded-full bg-[color-mix(in_srgb,var(--warn)_14%,transparent)] px-2.5 py-1 text-[12px] font-semibold text-warn">
                {area}
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-3">
          <TextField label="Nota de la publicación (opcional)" name="publish_note" value={note} maxLength={200} onChange={(event) => setNote(event.target.value)} placeholder="Campaña de feriado largo" hint="Te ayuda a reconocer esta versión en el historial." />
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" icon={<Rocket size={15} />} disabled={pending.length === 0 || busy || busySaving} onClick={() => run(() => publishSite(note), () => setNote(""))} data-testid="site-publish">
              {busySaving ? "Guardando…" : "Publicar cambios"}
            </Button>
            {pending.length > 0 && !confirmDiscard && (
              <Button icon={<RotateCcw size={15} />} disabled={busy} onClick={() => setConfirmDiscard(true)} data-testid="site-discard">
                Descartar borrador
              </Button>
            )}
            {confirmDiscard && (
              <span className="flex flex-wrap items-center gap-2 rounded-[12px] bg-[color-mix(in_srgb,var(--bad)_8%,transparent)] px-3 py-1.5 text-[12.5px]">
                Se perderán los cambios sin publicar.
                <Button size="sm" disabled={busy} onClick={() => run(discardSiteDraft, () => setConfirmDiscard(false))} data-testid="site-discard-confirm">
                  Sí, descartar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDiscard(false)}>
                  Cancelar
                </Button>
              </span>
            )}
            <Link href={home} target="_blank" className="ml-auto inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent">
              Ver el sitio publicado <ExternalLink size={13} />
            </Link>
          </div>
          {feedback && <p className={cn("text-[13px] font-semibold", feedback.ok ? "text-ok" : "text-bad")} data-testid="site-publish-feedback">{feedback.text}</p>}
        </div>
      </Card>

      <Card>
        <CardHeader title="Versiones publicadas" subtitle="Recupera una versión anterior: se copia al borrador para que la revises antes de volver a publicarla." />
        {data.versions.length === 0 ? (
          <p className="text-[13px] text-fg-3">Cada vez que publiques, la versión quedará guardada aquí.</p>
        ) : (
          <ol className="grid gap-2" data-testid="site-versions">
            {data.versions.map((version) => (
              <li key={version.version} className="flex items-center gap-3 rounded-[14px] border border-line px-3 py-2.5 transition hover:border-[color-mix(in_srgb,var(--accent)_30%,transparent)]">
                <span className="grid h-8 w-10 flex-none place-items-center rounded-lg bg-surface-2 text-[12px] font-bold text-fg-2">v{version.version}</span>
                <span className="min-w-0 flex-1 text-[12.5px]">
                  <b className="block truncate font-semibold text-fg">{version.note ?? "Sin nota"}</b>
                  <span className="text-fg-3">{[version.by, formatDateTime(version.at)].filter(Boolean).join(" · ")}</span>
                </span>
                {version.version === data.published_version ? (
                  <Badge tone="ok">En línea</Badge>
                ) : (
                  <Button size="sm" icon={<History size={14} />} disabled={busy} onClick={() => run(() => restoreSiteVersion(version.version))}>
                    Recuperar
                  </Button>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>

      <AuditTrail entries={data.history} empty="El sitio web aún no tiene cambios registrados." />
    </>
  );
}
