import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { HelpCreateAction } from "@/features/help/HelpArticleForms";
import { HelpCenter } from "@/features/help/HelpCenter";
import { helpQuery, PLATFORM_HELP, type HelpIndex } from "@/lib/help";
import { platformGet } from "@/lib/server/platform";
import { archivePlatformHelpArticle, createPlatformHelpArticle, restorePlatformHelpArticle, savePlatformHelpArticle } from "./actions";

export const metadata: Metadata = { title: "Centro de ayuda" };

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export default async function PlataformaAyudaPage({ searchParams }: PageProps<"/plataforma/ayuda">) {
  const params = await searchParams;
  const index = await platformGet<HelpIndex>(`/help/articles${helpQuery({ q: one(params.q), module: one(params.module), status: one(params.status), audience: one(params.audience) })}`);

  return (
    <>
      <PageHeader
        title="Centro de ayuda"
        subtitle="Los artículos de Qhapaq que ven todas las agencias y los de esta consola."
        info={<InfoTip>Cada agencia puede tener su propia versión de un artículo. Esa versión reemplaza la de Qhapaq solo para ella y no cambia aunque edites aquí el original.</InfoTip>}
        actions={<HelpCreateAction actions={{ create: createPlatformHelpArticle, save: savePlatformHelpArticle, archive: archivePlatformHelpArticle, restore: restorePlatformHelpArticle }} options={index.options} audiences />}
      />
      <HelpCenter index={{ ...index, can_manage: true }} realm={PLATFORM_HELP} />
    </>
  );
}
