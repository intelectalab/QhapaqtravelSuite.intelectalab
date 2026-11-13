import type { Metadata } from "next";
import { AiHistory } from "@/features/channels/AiContent";
import { getAiJobs } from "@/lib/server/aiContent";

export const metadata: Metadata = { title: "Historial de contenido con IA" };

export default async function AiHistoryPage() {
  const jobs = await getAiJobs();
  if (!jobs) return null;

  return <AiHistory jobs={jobs.items} options={jobs.options} />;
}
