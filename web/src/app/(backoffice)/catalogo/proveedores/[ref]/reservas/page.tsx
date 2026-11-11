import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProviderReservationsTable } from "@/features/catalog-providers/ProviderDetail";
import { getProvider } from "@/lib/server/catalog-supply";

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }): Promise<Metadata> {
  const { ref } = await params;
  const detail = await getProvider(decodeURIComponent(ref));
  return { title: detail ? `Reservas · ${detail.provider.name}` : "Reservas" };
}

export default async function ProveedorSectionPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const detail = await getProvider(decodeURIComponent(ref));
  if (!detail || detail.reservations === null) notFound();
  return <ProviderReservationsTable detail={detail} />;
}
