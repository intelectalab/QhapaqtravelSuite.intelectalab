"use client";

import { Languages, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { removeProductTranslation, saveProductTranslation, type ProductActionState } from "@/app/(backoffice)/catalogo/productos/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PanelAction } from "@/components/ui/PanelAction";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { TintCardTitle } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import type { ProductTranslations } from "@/lib/catalog";
import { formatDateTime } from "@/lib/format";

const initial: ProductActionState = { message: null, done: false };

const LANGUAGE: Record<string, string> = { en: "Inglés" };

function Reference({ children }: { children: React.ReactNode }) {
  return <span className="mt-1 block text-[12px] leading-snug text-fg-3">Español: {children}</span>;
}

function TranslationEditor({ data, locale, canEdit }: { data: ProductTranslations; locale: string; canEdit: boolean }) {
  const router = useRouter();
  const current = data.translations.find((item) => item.locale === locale);
  const { base } = data;
  if (!current || !canEdit) return null;
  return (
    <PanelAction<ProductActionState>
      label={current.exists ? "Editar" : "Traducir"}
      icon={<Pencil size={15} />}
      formId={`product-translation-${data.code}-${locale}`}
      title={`Traducción al ${LANGUAGE[locale]?.toLowerCase() ?? locale}`}
      description="Lo que escribas aquí se muestra en el sitio web cuando el visitante elige ese idioma. Lo que dejes vacío se muestra en español."
      submitLabel="Guardar traducción"
      action={saveProductTranslation}
      initial={initial}
      testId={`product-translation:${locale}`}
      trigger={(open) => (
        <Button size="sm" variant={current.exists ? "ghost" : "secondary"} icon={<Pencil size={15} />} onClick={open} data-testid={`product-translation:${locale}`}>
          {current.exists ? "Editar" : "Traducir"}
        </Button>
      )}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={data.code} />
          <input type="hidden" name="locale" value={locale} />
          <div>
            <TextField label="Nombre" name="name" required minLength={3} maxLength={160} defaultValue={current.name ?? ""} />
            <Reference>{base.name}</Reference>
          </div>
          <div>
            <TextArea label="Resumen" name="short" rows={2} maxLength={600} defaultValue={current.short ?? ""} />
            {base.short && <Reference>{base.short}</Reference>}
          </div>
          <div>
            <TextArea label="Descripción" name="long" rows={5} maxLength={8000} defaultValue={current.long ?? ""} />
            {base.long && <Reference>{base.long.length > 180 ? `${base.long.slice(0, 180)}…` : base.long}</Reference>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <TextArea label="Incluye (una línea por punto)" name="inclusions" rows={4} defaultValue={current.inclusions.join("\n")} />
              {base.inclusions.length > 0 && <Reference>{base.inclusions.join(" · ")}</Reference>}
            </div>
            <div>
              <TextArea label="No incluye (una línea por punto)" name="exclusions" rows={4} defaultValue={current.exclusions.join("\n")} />
              {base.exclusions.length > 0 && <Reference>{base.exclusions.join(" · ")}</Reference>}
            </div>
          </div>
          <TextField label="Título para buscadores (opcional)" name="seo_title" maxLength={120} defaultValue={current.seo_title ?? ""} />
          <TextArea label="Descripción para buscadores (opcional)" name="seo_description" rows={2} maxLength={320} defaultValue={current.seo_description ?? ""} />
        </>
      )}
    </PanelAction>
  );
}

function RemoveTranslation({ code, locale }: { code: string; locale: string }) {
  const router = useRouter();
  return (
    <PanelAction<ProductActionState>
      label="Quitar"
      icon={<Trash2 size={15} />}
      formId={`product-translation-remove-${code}-${locale}`}
      title="Quitar traducción"
      description="El sitio volverá a mostrar este producto en español para los visitantes que elijan este idioma."
      submitLabel="Quitar traducción"
      action={removeProductTranslation}
      initial={initial}
      trigger={(open) => <Button size="sm" variant="ghost" iconOnly icon={<Trash2 size={15} />} label="Quitar traducción" onClick={open} />}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={code} />
          <input type="hidden" name="locale" value={locale} />
        </>
      )}
    </PanelAction>
  );
}

export function ProductTranslationsCard({ data, canEdit }: { data: ProductTranslations; canEdit: boolean }) {
  return (
    <Card>
      <TintCardTitle icon={Languages} title="Idiomas del sitio web" />
      <ul className="flex flex-col">
        <li className="flex items-center gap-3 border-t border-line-2 py-2.5 text-[13px] first:border-t-0">
          <span className="min-w-0 flex-1">
            <b className="block font-semibold">Español</b>
            <span className="text-xs text-fg-3">Idioma base del catálogo</span>
          </span>
          <span className="rounded-full bg-[color-mix(in_srgb,var(--ok)_13%,transparent)] px-2.5 py-1 text-[12px] font-semibold text-ok">Publicado</span>
        </li>
        {data.translations.map((item) => (
          <li key={item.locale} data-testid={`product-language:${item.locale}`} data-state={item.exists ? "translated" : "missing"} className="flex flex-wrap items-center gap-3 border-t border-line-2 py-2.5 text-[13px] first:border-t-0">
            <span className="min-w-0 flex-1">
              <b className="block font-semibold">{LANGUAGE[item.locale] ?? item.locale}</b>
              <span className="text-xs text-fg-3">{item.exists ? `${item.name}${item.updated_at ? ` · actualizado ${formatDateTime(item.updated_at)}` : ""}` : "Sin traducir: el sitio lo muestra en español con un aviso"}</span>
            </span>
            <span className={cn("rounded-full px-2.5 py-1 text-[12px] font-semibold", item.exists ? "bg-[color-mix(in_srgb,var(--ok)_13%,transparent)] text-ok" : "bg-surface-2 text-fg-3")}>{item.exists ? "Traducido" : "Pendiente"}</span>
            <TranslationEditor data={data} locale={item.locale} canEdit={canEdit} />
            {canEdit && item.exists && <RemoveTranslation code={data.code} locale={item.locale} />}
          </li>
        ))}
      </ul>
    </Card>
  );
}
