import type { Metadata } from "next";
import { ListingView } from "@/features/site/ListingView";
import { pickListing } from "@/lib/site";

export const metadata: Metadata = { title: "Tours, paquetes y experiencias" };

export default async function ToursPage({ params, searchParams }: PageProps<"/sitio/[agencia]/tours">) {
  const [{ agencia }, search] = await Promise.all([params, searchParams]);
  return <ListingView agencia={agencia} params={pickListing(search)} mode="catalogo" />;
}
