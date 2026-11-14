import type { Metadata } from "next";
import { MobileAppVersionsBoard, type MobileAppVersionsSummary } from "@/features/platform/MobileAppVersions";
import { platformGet } from "@/lib/server/platform";

export const metadata: Metadata = { title: "App móvil" };

export default async function AppMovilPage() {
  const summary = await platformGet<MobileAppVersionsSummary>("/settings/mobile-app");

  return <MobileAppVersionsBoard summary={summary} canEdit />;
}
