import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContractRequests } from "@/features/catalog-allotments/AllotmentDetail";
import { getAllotment } from "@/lib/server/allotments";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const detail = await getAllotment(code);
  return { title: detail ? `Ampliaciones · ${detail.contract.name}` : "Ampliaciones" };
}

export default async function CupoSectionPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const detail = await getAllotment(code);
  if (!detail) notFound();
  return <ContractRequests detail={detail} />;
}
