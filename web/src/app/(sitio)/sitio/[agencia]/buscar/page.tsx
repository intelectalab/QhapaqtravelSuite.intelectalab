import type { Metadata } from "next";
import { ListingView } from "@/features/site/ListingView";
import { siteLocale } from "@/lib/server/site";
import { pickListing } from "@/lib/site";
import { siteText } from "@/lib/site-i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: siteText(await siteLocale()).listing.searchTitle, robots: { index: false, follow: true } };
}

export default async function SearchPage({ params, searchParams }: PageProps<"/sitio/[agencia]/buscar">) {
  const [{ agencia }, search] = await Promise.all([params, searchParams]);
  return <ListingView agencia={agencia} params={pickListing(search)} mode="busqueda" />;
}
