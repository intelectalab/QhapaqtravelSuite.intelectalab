import type { Metadata } from "next";
import { AgencyCatalogView } from "@/features/b2b-portal/AgencyCatalog";
import type { AgencyCatalog } from "@/lib/b2b-portal";
import { agencyData } from "@/lib/server/b2b-portal";

export const metadata: Metadata = { title: "Catálogo" };

export default async function AgencyCatalogPage() {
  const catalog = await agencyData<AgencyCatalog>("/catalog", "No pudimos cargar el catálogo.");
  if (!catalog) return null;
  return <AgencyCatalogView catalog={catalog} />;
}
