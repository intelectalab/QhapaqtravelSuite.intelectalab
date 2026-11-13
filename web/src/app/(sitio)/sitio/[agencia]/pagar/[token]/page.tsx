import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicPayView } from "@/features/growth-ops/PublicPay";
import type { PublicPayLink } from "@/lib/growth-ops";
import { readSite } from "@/lib/server/site";

export const metadata: Metadata = { title: "Pagar", robots: { index: false, follow: false } };

export default async function PayLinkPage({ params }: { params: Promise<{ agencia: string; token: string }> }) {
  const { agencia, token } = await params;
  const result = await readSite<PublicPayLink>(agencia, `/pay/${encodeURIComponent(token)}`);
  if (!result.ok || !result.data) notFound();
  return <PublicPayView agencia={agencia} token={token} link={result.data} />;
}
