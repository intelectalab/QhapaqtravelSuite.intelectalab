import type { Metadata } from "next";
import { HelpArticleView } from "@/features/help/HelpArticleView";
import { PLATFORM_HELP, type HelpArticle } from "@/lib/help";
import { platformGet } from "@/lib/server/platform";
import { archivePlatformHelpArticle, createPlatformHelpArticle, restorePlatformHelpArticle, savePlatformHelpArticle } from "../actions";

const load = (slug: string) => platformGet<HelpArticle>(`/help/articles/${encodeURIComponent(slug)}`);

export async function generateMetadata({ params }: PageProps<"/plataforma/ayuda/[slug]">): Promise<Metadata> {
  const article = await load((await params).slug);
  return { title: `${article.title} · Ayuda` };
}

export default async function PlataformaAyudaArticuloPage({ params, searchParams }: PageProps<"/plataforma/ayuda/[slug]">) {
  const { slug } = await params;
  const { editar } = await searchParams;
  const article = await load(slug);

  return <HelpArticleView article={article} realm={PLATFORM_HELP} editing={editar === "1"} actions={{ create: createPlatformHelpArticle, save: savePlatformHelpArticle, archive: archivePlatformHelpArticle, restore: restorePlatformHelpArticle }} />;
}
