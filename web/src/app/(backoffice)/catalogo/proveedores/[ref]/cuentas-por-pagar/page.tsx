import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProviderPayablesTable } from "@/features/catalog-providers/ProviderDetail";
import { getProvider } from "@/lib/server/catalog-supply";

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }): Promise<Metadata> {
  const { ref } = await params;
  const detail = await getProvider(decodeURIComponent(ref));
  return { title: detail ? `Cuentas por pagar · ${detail.provider.name}` : "Cuentas por pagar" };
}

export default async function ProveedorSectionPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const detail = await getProvider(decodeURIComponent(ref));
  if (!detail || detail.payables === null) notFound();
  return <ProviderPayablesTable detail={detail} />;
}
