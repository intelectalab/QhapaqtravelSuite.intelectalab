import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContractPenalties } from "@/features/catalog-allotments/AllotmentDetail";
import { getAllotment } from "@/lib/server/allotments";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const detail = await getAllotment(code);
  return { title: detail ? `Penalidades · ${detail.contract.name}` : "Penalidades" };
}

export default async function CupoPenaltiesPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const detail = await getAllotment(code);
  if (!detail) notFound();
  return <ContractPenalties detail={detail} />;
}
