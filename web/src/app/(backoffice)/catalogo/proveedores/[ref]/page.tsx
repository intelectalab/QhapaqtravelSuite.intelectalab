import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProviderSummary } from "@/features/catalog-providers/ProviderDetail";
import { getProvider } from "@/lib/server/catalog-supply";

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }): Promise<Metadata> {
  const { ref } = await params;
  const detail = await getProvider(decodeURIComponent(ref));
  return { title: detail ? `Datos y contactos · ${detail.provider.name}` : "Datos y contactos" };
}

export default async function ProveedorSectionPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const detail = await getProvider(decodeURIComponent(ref));
  if (!detail) notFound();
  return <ProviderSummary detail={detail} />;
}
