import type { Metadata } from "next";
import { GiftShopView } from "@/features/growth-ops/PublicPay";
import { getSiteProfile } from "@/lib/server/site";

export const metadata: Metadata = { title: "Vale de regalo" };

export default async function GiftCardShopPage({ params }: { params: Promise<{ agencia: string }> }) {
  const { agencia } = await params;
  const profile = await getSiteProfile(agencia);
  return <GiftShopView agencia={agencia} agency={profile.agency.name} />;
}
