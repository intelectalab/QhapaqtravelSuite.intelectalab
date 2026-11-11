import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HistoryTable } from "@/features/catalog-shared/HistoryTable";
import { getService } from "@/lib/server/catalog-supply";

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }): Promise<Metadata> {
  const { ref } = await params;
  const detail = await getService(decodeURIComponent(ref));
  return { title: detail ? `Historial · ${detail.service.name}` : "Historial" };
}

export default async function ServicioHistorialPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const detail = await getService(decodeURIComponent(ref));
  if (!detail?.history) notFound();
  return <HistoryTable screen="servicio-historial" events={detail.history} fileName={`historial-${detail.service.ref}`} />;
}
