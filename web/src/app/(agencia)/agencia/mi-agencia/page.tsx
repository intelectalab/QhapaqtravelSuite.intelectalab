import type { Metadata } from "next";
import { AgencyProfileView } from "@/features/b2b-portal/AgencyProfile";
import type { AgencyProfile } from "@/lib/b2b-portal";
import { agencyData } from "@/lib/server/b2b-portal";

export const metadata: Metadata = { title: "Mi agencia" };

export default async function AgencyProfilePage() {
  const profile = await agencyData<AgencyProfile>("/agency", "No pudimos cargar los datos de tu agencia.");
  if (!profile) return null;
  return <AgencyProfileView profile={profile} />;
}
