import type { Metadata } from "next";
import { ListingView } from "@/features/site/ListingView";
import { pickListing } from "@/lib/site";

export const metadata: Metadata = { title: "Buscar disponibilidad", robots: { index: false, follow: true } };

export default async function SearchPage({ params, searchParams }: PageProps<"/sitio/[agencia]/buscar">) {
  const [{ agencia }, search] = await Promise.all([params, searchParams]);
  return <ListingView agencia={agencia} params={pickListing(search)} mode="busqueda" />;
}
