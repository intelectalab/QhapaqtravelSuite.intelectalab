import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { HelpCreateAction } from "@/features/help/HelpArticleForms";
import { HelpCenter } from "@/features/help/HelpCenter";
import { AGENCY_HELP, helpQuery, type HelpIndex } from "@/lib/help";
import { getResource } from "@/lib/server/resource";
import { archiveHelpArticle, createHelpArticle, originalHelpArticle, restoreHelpArticle, saveHelpArticle } from "./actions";

export const metadata: Metadata = { title: "Centro de ayuda" };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default async function AyudaPage({ searchParams }: PageProps<"/ayuda">) {
  const params = await searchParams;
  const index = await getResource<HelpIndex>(`/help/articles${helpQuery({ q: one(params.q), module: one(params.module), status: one(params.status) })}`, "No pudimos cargar el centro de ayuda.");

  if (!index) {
    return <PageHeader title="Centro de ayuda" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  return (
    <>
      <PageHeader
        title="Centro de ayuda"
        subtitle="Guías de cada pantalla, cómo se usan sus acciones y respuestas a las dudas frecuentes."
        info={<InfoTip>El botón de ayuda de la barra superior abre el artículo de la pantalla en la que estás. Aquí encuentras todos los artículos que aplican a tu rol.</InfoTip>}
        actions={index.can_manage ? <HelpCreateAction actions={{ create: createHelpArticle, save: saveHelpArticle, archive: archiveHelpArticle, restore: restoreHelpArticle, original: originalHelpArticle }} options={index.options} /> : undefined}
      />
      <HelpCenter index={index} realm={AGENCY_HELP} />
    </>
  );
}
