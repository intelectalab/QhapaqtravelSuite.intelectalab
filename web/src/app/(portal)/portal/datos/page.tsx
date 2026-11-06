import type { Metadata } from "next";
import { PortalProfileView } from "@/features/portal/PortalProfileView";
import type { PortalProfile } from "@/lib/portal";
import { portalData } from "@/lib/server/portal";

export const metadata: Metadata = { title: "Mis datos" };

export default async function PortalProfilePage() {
  const profile = await portalData<PortalProfile>("/profile", "No pudimos cargar tus datos.");
  return <PortalProfileView profile={profile} />;
}
