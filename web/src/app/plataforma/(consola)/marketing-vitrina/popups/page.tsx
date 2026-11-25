import type { Metadata } from "next";
import { PopupsTable } from "@/features/platform/LandingConsole";
import type { PopupsOverview } from "@/lib/landing-content";
import { platformGet } from "@/lib/server/platform";

export const metadata: Metadata = { title: "Popups de la landing" };

export default async function LandingPopupsPage() {
  return <PopupsTable overview={await platformGet<PopupsOverview>("/landing/popups")} />;
}
