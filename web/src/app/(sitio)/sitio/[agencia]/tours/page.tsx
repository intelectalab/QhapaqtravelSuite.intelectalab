import type { Metadata } from "next";
import { ListingView } from "@/features/site/ListingView";
import { siteLocale } from "@/lib/server/site";
import { pickListing } from "@/lib/site";
import { siteText } from "@/lib/site-i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: siteText(await siteLocale()).listing.metaCatalog };
}

export default async function ToursPage({ params, searchParams }: PageProps<"/sitio/[agencia]/tours">) {
  const [{ agencia }, search] = await Promise.all([params, searchParams]);
  return <ListingView agencia={agencia} params={pickListing(search)} mode="catalogo" />;
}
