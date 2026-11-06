import type { Metadata } from "next";
import { AgencyHomeView } from "@/features/b2b-portal/AgencyHome";
import type { AgencyHome } from "@/lib/b2b-portal";
import { agencyData, agencySession } from "@/lib/server/b2b-portal";

export const metadata: Metadata = { title: "Inicio" };

export default async function AgencyHomePage() {
  const [session, home] = await Promise.all([agencySession(), agencyData<AgencyHome>("/home", "No pudimos cargar el inicio de tu agencia.")]);
  if (!session || !home) return null;
  return <AgencyHomeView home={home} session={session} />;
}
