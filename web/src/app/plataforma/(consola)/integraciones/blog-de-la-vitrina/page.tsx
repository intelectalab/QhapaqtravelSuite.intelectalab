import type { Metadata } from "next";
import { PayloadBlogCard } from "@/features/platform/PayloadBlogCard";
import type { PayloadWebhookSummary } from "@/lib/platform";
import { platformGet } from "@/lib/server/platform";

export const metadata: Metadata = { title: "Blog de la vitrina" };

export default async function BlogDeLaVitrinaPage() {
  return <PayloadBlogCard payload={await platformGet<PayloadWebhookSummary>("/integrations/payload")} />;
}
