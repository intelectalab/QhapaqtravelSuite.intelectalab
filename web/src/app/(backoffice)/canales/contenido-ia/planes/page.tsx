import type { Metadata } from "next";
import { AiPlans } from "@/features/channels/AiContent";
import { getAiLedger, getAiPacks } from "@/lib/server/aiContent";

export const metadata: Metadata = { title: "Planes y créditos de IA" };

export default async function AiPlansPage() {
  const [packs, ledger] = await Promise.all([getAiPacks(), getAiLedger()]);
  if (!packs || !ledger) return null;

  return <AiPlans packs={packs} ledger={ledger} />;
}
