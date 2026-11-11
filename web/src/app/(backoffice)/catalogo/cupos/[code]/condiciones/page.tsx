import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContractConditions } from "@/features/catalog-allotments/AllotmentDetail";
import { getAllotment } from "@/lib/server/allotments";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const detail = await getAllotment(code);
  return { title: detail ? `Condiciones · ${detail.contract.name}` : "Condiciones" };
}

export default async function CupoSectionPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const detail = await getAllotment(code);
  if (!detail) notFound();
  return <ContractConditions detail={detail} />;
}
