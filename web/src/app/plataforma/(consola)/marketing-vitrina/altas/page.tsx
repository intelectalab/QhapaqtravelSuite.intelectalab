import type { Metadata } from "next";
import { SignupsPanel } from "@/features/tracking/PlatformMarketing";
import { platformGet } from "@/lib/server/platform";
import type { LandingSignups } from "@/lib/tracking";

export const metadata: Metadata = { title: "Altas desde la landing" };

export default async function AltasLandingPage() {
  return <SignupsPanel data={await platformGet<LandingSignups>("/signups")} />;
}
