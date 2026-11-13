import type { Metadata } from "next";
import { AiImagesView } from "@/features/channels/AiContent";
import { getAiCredits, getAiImages, getAiJobs } from "@/lib/server/aiContent";

export const metadata: Metadata = { title: "Imágenes con IA" };

export default async function AiImagesPage() {
  const [summary, jobs, images] = await Promise.all([getAiCredits(), getAiJobs(), getAiImages()]);
  if (!summary || !jobs || !images) return null;

  return <AiImagesView images={images} options={jobs.options} costs={summary.costs} balance={summary.balances.imagenes.balance} />;
}
