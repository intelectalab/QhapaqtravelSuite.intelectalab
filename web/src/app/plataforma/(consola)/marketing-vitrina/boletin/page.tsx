import type { Metadata } from "next";
import { SubscribersTable } from "@/features/platform/LandingConsole";
import type { SubscribersOverview } from "@/lib/landing-content";
import { platformGet } from "@/lib/server/platform";

export const metadata: Metadata = { title: "Boletín de la landing" };

export default async function LandingNewsletterPage() {
  return <SubscribersTable overview={await platformGet<SubscribersOverview>("/landing/subscribers")} />;
}
