import type { Metadata } from "next";
import { AntivirusCard } from "@/features/platform/PlatformConnections";
import type { PlatformSettingsOverview } from "@/lib/platform";
import { platformGet } from "@/lib/server/platform";

export const metadata: Metadata = { title: "Antivirus" };

export default async function AntivirusPage() {
  const data = await platformGet<PlatformSettingsOverview>("/settings");

  return <AntivirusCard antivirus={data.sections.antivirus} />;
}
