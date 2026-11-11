import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServiceSheet } from "@/features/catalog-services/ServiceDetail";
import { getService } from "@/lib/server/catalog-supply";

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }): Promise<Metadata> {
  const { ref } = await params;
  const detail = await getService(decodeURIComponent(ref));
  return { title: detail ? `Ficha · ${detail.service.name}` : "Ficha" };
}

export default async function ServicioSectionPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const detail = await getService(decodeURIComponent(ref));
  if (!detail) notFound();
  return <ServiceSheet detail={detail} />;
}
