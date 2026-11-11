import type { Metadata } from "next";
import { PortalDocuments, type PortalDocument } from "@/features/portal/PortalInbox";
import { portalData } from "@/lib/server/portal";

export const metadata: Metadata = { title: "Documentos" };

export default async function PortalDocumentsPage() {
  const { items } = await portalData<{ items: PortalDocument[] }>("/documents", "No pudimos cargar tus documentos.");
  return <PortalDocuments items={items} />;
}
