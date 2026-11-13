import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContractHistory } from "@/features/catalog-allotments/AllotmentDetail";
import { getAllotment } from "@/lib/server/allotments";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const detail = await getAllotment(code);
  return { title: detail ? `Historial · ${detail.contract.name}` : "Historial" };
}

export default async function CupoHistoryPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const detail = await getAllotment(code);
  if (!detail) notFound();
  return <ContractHistory detail={detail} />;
}
