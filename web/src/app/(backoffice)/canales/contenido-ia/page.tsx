import type { Metadata } from "next";
import { AiJobForm, ReviewQueue } from "@/features/channels/AiContent";
import { getAiCredits, getAiJobs } from "@/lib/server/aiContent";

export const metadata: Metadata = { title: "Contenido con IA" };

export default async function AiContentPage() {
  const [summary, jobs] = await Promise.all([getAiCredits(), getAiJobs()]);
  if (!summary || !jobs) return null;

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <AiJobForm options={jobs.options} costs={summary.costs} balance={summary.balances.contenido.balance} />
      <ReviewQueue jobs={jobs.items} />
    </div>
  );
}
