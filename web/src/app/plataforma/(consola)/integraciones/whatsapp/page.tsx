import type { Metadata } from "next";
import { WhatsappAppCard } from "@/features/platform/WhatsappAppCard";
import type { WhatsappAppSummary } from "@/lib/platform";
import { platformGet } from "@/lib/server/platform";

export const metadata: Metadata = { title: "WhatsApp" };

export default async function IntegracionWhatsappPage() {
  const app = await platformGet<WhatsappAppSummary>("/integrations/whatsapp");

  return <WhatsappAppCard app={app} />;
}
