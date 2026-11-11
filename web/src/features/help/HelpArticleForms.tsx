"use client";

import { Archive, ArchiveRestore, BookPlus, Pencil, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChipToggleGroup } from "@/components/ui/ChipToggleGroup";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { RepeatableFields } from "@/components/ui/RepeatableFields";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { NAV_GROUPS, type NavGroup } from "@/config/navigation";
import { PLATFORM_NAV_GROUPS } from "@/config/platformNavigation";
import { HiddenFields, STEP_INITIAL } from "@/features/catalog-shared/CatalogPanels";
import type { HelpArticle, HelpAudience, HelpOptions } from "@/lib/help";
import type { StepResult } from "@/lib/server/resource";

type Step = (state: StepResult, form: FormData) => Promise<StepResult>;

export interface HelpActionSet {
  create: Step;
  save: Step;
  archive: Step;
  restore: Step;
  original?: Step;
}

const EXTRA_SCREENS: Record<HelpAudience, { href: string; label: string }[]> = {
  agency: [{ href: "/cuenta", label: "Mi cuenta" }],
  platform: [],
};

function navFor(audience: HelpAudience): NavGroup[] {
  return audience === "platform" ? PLATFORM_NAV_GROUPS : NAV_GROUPS;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function HelpArticleFields({ article, options, audiences }: { article?: HelpArticle; options: HelpOptions | null; audiences: boolean }) {
  const [audience, setAudience] = useState<HelpAudience>(article?.audience ?? "agency");
  const [screen, setScreen] = useState(article?.screen ?? "");
  const groups = navFor(audience);
  const screens = [...groups.flatMap((group) => group.screens.map((item) => ({ value: item.href, label: item.label, hint: `${group.label} · ${item.href}` }))), ...EXTRA_SCREENS[audience].map((item) => ({ value: item.href, label: item.label, hint: item.href }))];
  const modules = unique([...groups.map((group) => group.label), ...(audience === "platform" ? (options?.platform_modules ?? []) : (options?.modules ?? [])), article?.module ?? ""]);
  const groupOf = (href: string) => groups.find((group) => group.screens.some((item) => href === item.href || href.startsWith(`${item.href}/`)))?.label;
  const moduleDefault = article && screen === article.screen ? article.module : (groupOf(screen) ?? article?.module ?? "");

  return (
    <>
      {audiences && (
        <ChoiceGroup
          label="Para quién es"
          name="audience"
          options={(options?.audiences ?? []).map((item) => ({ value: item.value, label: item.label }))}
          defaultValue={audience}
          onChange={(value) => {
            setAudience(value as HelpAudience);
            setScreen("");
          }}
        />
      )}
      <TextField label="Título" name="title" required minLength={3} maxLength={160} defaultValue={article?.title} placeholder="Por ejemplo: Clientes" />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField key={`module-${audience}-${moduleDefault}`} label="Módulo" name="module" options={modules.map((value) => ({ value, label: value }))} defaultValue={moduleDefault} placeholder="Elige el módulo" />
        <SelectField key={`screen-${audience}`} label="Pantalla del menú" name="screen_pick" options={screens} defaultValue={screens.some((item) => item.value === screen) ? screen : ""} placeholder="Elige una pantalla" onChange={setScreen} />
      </div>
      <TextField label="Ruta de la pantalla" name="screen" required maxLength={120} pattern="^/[a-z0-9/_\-]*$" value={screen} onChange={(event) => setScreen(event.target.value)} placeholder="/crm/clientes" hint="La ayuda también aparece en las páginas que cuelgan de esta ruta, como la ficha de un registro." />
      <TextArea label="De qué trata la pantalla" name="summary" rows={3} required minLength={10} maxLength={600} defaultValue={article?.summary} placeholder="Una o dos frases: qué es y para qué sirve." />
      <RepeatableFields label="Cómo se usa" name="steps" itemLabel="Paso" addLabel="Agregar paso" max={8} defaultValue={article?.steps.map((step) => ({ title: step.title, text: step.text })) ?? [{ title: "", text: "" }]} fields={[{ key: "title", label: "Acción", maxLength: 120, placeholder: "Por ejemplo: Registrar un cliente" }, { key: "text", label: "Explicación", multiline: true, maxLength: 600, placeholder: "Qué botón usar y qué pasa después." }]} />
      <RepeatableFields label="Dudas frecuentes" name="faqs" itemLabel="Pregunta" addLabel="Agregar pregunta" max={10} defaultValue={article?.faqs.map((faq) => ({ question: faq.question, answer: faq.answer })) ?? [{ question: "", answer: "" }]} fields={[{ key: "question", label: "Pregunta", maxLength: 200, placeholder: "¿Por qué no veo…?" }, { key: "answer", label: "Respuesta", multiline: true, maxLength: 800 }]} />
      <TextField label="Palabras clave" name="keywords" maxLength={400} defaultValue={article?.keywords.join(", ")} placeholder="cartera, ruc, contacto" hint="Sepáralas con comas. Ayudan a encontrar el artículo en el buscador." />
      {audience === "agency" && options && options.roles.length > 0 && <ChipToggleGroup label="Solo para estos roles" name="roles" options={options.roles} defaultValue={article?.roles ?? []} hint="Déjalo vacío para que lo vea cualquier rol con acceso a la pantalla." />}
    </>
  );
}

export function HelpCreateAction({ actions, options, audiences = false }: { actions: HelpActionSet; options: HelpOptions | null; audiences?: boolean }) {
  return (
    <PanelAction<StepResult> label="Nuevo artículo" icon={<BookPlus size={16} />} variant="primary" formId="help-create" title="Nuevo artículo de ayuda" description="Explica una pantalla: qué es, cómo se usan sus acciones y las dudas que suelen aparecer." submitLabel="Crear artículo" action={actions.create} initial={STEP_INITIAL} testId="help-create">
      {() => <HelpArticleFields options={options} audiences={audiences} />}
    </PanelAction>
  );
}

export function HelpEditAction({ article, actions, defaultOpen = false }: { article: HelpArticle; actions: HelpActionSet; defaultOpen?: boolean }) {
  const router = useRouter();
  const adapting = article.origin === "kipucontrol" && !!actions.original;
  return (
    <PanelAction<StepResult>
      label="Editar"
      icon={<Pencil size={15} />}
      formId={`help-edit-${article.slug}`}
      title={`Editar «${article.title}»`}
      description={adapting ? "Tus cambios crean la versión de tu agencia. La de KipuControl queda guardada y puedes volver a ella cuando quieras." : "Los cambios se ven al instante en el botón de ayuda y en el centro de ayuda."}
      submitLabel="Guardar cambios"
      action={actions.save}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
      defaultOpen={defaultOpen}
      testId="help-edit"
    >
      {() => (
        <>
          <HiddenFields values={{ slug: article.slug, lock_version: article.lock_version }} />
          <HelpArticleFields article={article} options={article.options} audiences={false} />
        </>
      )}
    </PanelAction>
  );
}

function ConfirmAction({ article, action, label, icon, title, description, submitLabel, testId }: { article: HelpArticle; action: Step; label: string; icon: React.ReactNode; title: string; description: string; submitLabel: string; testId: string }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult> label={label} icon={icon} variant="ghost" size="sm" formId={`${testId}-${article.slug}`} title={title} description={description} submitLabel={submitLabel} action={action} initial={STEP_INITIAL} onDone={() => router.refresh()} testId={testId}>
      {() => <HiddenFields values={{ slug: article.slug, lock_version: article.lock_version }} />}
    </PanelAction>
  );
}

export function HelpStatusActions({ article, actions, platform = false }: { article: HelpArticle; actions: HelpActionSet; platform?: boolean }) {
  const archived = article.status === "archived";
  return (
    <>
      {archived ? (
        <ConfirmAction article={article} action={actions.restore} label="Reactivar" icon={<ArchiveRestore size={15} />} title="Reactivar artículo" description={`«${article.title}» vuelve a aparecer en el botón de ayuda y en el centro de ayuda.`} submitLabel="Reactivar" testId="help-restore" />
      ) : (
        <ConfirmAction
          article={article}
          action={actions.archive}
          label="Archivar"
          icon={<Archive size={15} />}
          title="Archivar artículo"
          description={platform ? `«${article.title}» deja de mostrarse a todas las agencias que usan la versión de KipuControl. Las que tienen su propia versión la conservan.` : `«${article.title}» deja de mostrarse a tu equipo. Puedes reactivarlo cuando quieras.`}
          submitLabel="Archivar"
          testId="help-archive"
        />
      )}
      {actions.original && article.origin === "adaptado" && (
        <ConfirmAction article={article} action={actions.original} label="Volver a la versión de KipuControl" icon={<RotateCcw size={15} />} title="Volver a la versión de KipuControl" description="Se descarta la versión de tu agencia y el artículo vuelve a mostrar el contenido original. El cambio queda en el historial." submitLabel="Volver a la original" testId="help-original" />
      )}
    </>
  );
}
