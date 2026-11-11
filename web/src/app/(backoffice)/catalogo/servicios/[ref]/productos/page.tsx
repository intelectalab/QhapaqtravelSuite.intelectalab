import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ServiceUsageTable } from "@/features/catalog-services/ServiceDetail";
import { getService } from "@/lib/server/catalog-supply";

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }): Promise<Metadata> {
  const { ref } = await params;
  const detail = await getService(decodeURIComponent(ref));
  return { title: detail ? `Productos que lo usan · ${detail.service.name}` : "Productos que lo usan" };
}

export default async function ServicioSectionPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const detail = await getService(decodeURIComponent(ref));
  if (!detail) notFound();
  return <ServiceUsageTable detail={detail} />;
}
