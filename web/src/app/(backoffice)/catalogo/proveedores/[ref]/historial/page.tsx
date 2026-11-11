import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HistoryTable } from "@/features/catalog-shared/HistoryTable";
import { getProvider } from "@/lib/server/catalog-supply";

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }): Promise<Metadata> {
  const { ref } = await params;
  const detail = await getProvider(decodeURIComponent(ref));
  return { title: detail ? `Historial · ${detail.provider.name}` : "Historial" };
}

export default async function ProveedorHistorialPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  const detail = await getProvider(decodeURIComponent(ref));
  if (!detail?.history) notFound();
  return <HistoryTable screen="proveedor-historial" events={detail.history} fileName={`historial-${detail.provider.ref}`} />;
}
