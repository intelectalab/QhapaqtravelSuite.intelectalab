import type { Metadata } from "next";
import { AiPlans } from "@/features/channels/AiContent";
import { getAiCredits, getAiLedger, getAiPacks } from "@/lib/server/aiContent";

export const metadata: Metadata = { title: "Planes y créditos de IA" };

export default async function AiPlansPage() {
  const [packs, ledger, summary] = await Promise.all([getAiPacks(), getAiLedger(), getAiCredits()]);
  if (!packs || !ledger || !summary) return null;

  return <AiPlans packs={packs} ledger={ledger} summary={summary} />;
}
