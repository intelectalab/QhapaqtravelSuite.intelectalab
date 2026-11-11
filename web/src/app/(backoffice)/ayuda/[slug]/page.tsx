import type { Metadata } from "next";
import { HelpArticleView } from "@/features/help/HelpArticleView";
import { AGENCY_HELP, type HelpArticle } from "@/lib/help";
import { getResource } from "@/lib/server/resource";
import { PageHeader } from "@/components/shell/PageHeader";
import { archiveHelpArticle, createHelpArticle, originalHelpArticle, restoreHelpArticle, saveHelpArticle } from "../actions";

const load = (slug: string) => getResource<HelpArticle>(`/help/articles/${encodeURIComponent(slug)}`, "No pudimos cargar el artículo.");

export async function generateMetadata({ params }: PageProps<"/ayuda/[slug]">): Promise<Metadata> {
  const article = await load((await params).slug);
  return { title: article ? `${article.title} · Ayuda` : "Centro de ayuda" };
}

export default async function AyudaArticuloPage({ params, searchParams }: PageProps<"/ayuda/[slug]">) {
  const { slug } = await params;
  const { editar } = await searchParams;
  const article = await load(slug);

  if (!article) {
    return <PageHeader title="Centro de ayuda" subtitle="Tu rol no tiene acceso a este artículo." back={{ href: AGENCY_HELP.centerHref, label: "Centro de ayuda" }} />;
  }

  return <HelpArticleView article={article} realm={AGENCY_HELP} editing={editar === "1"} actions={{ create: createHelpArticle, save: saveHelpArticle, archive: archiveHelpArticle, restore: restoreHelpArticle, original: originalHelpArticle }} />;
}
