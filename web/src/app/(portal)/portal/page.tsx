import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PortalHomeView } from "@/features/portal/PortalHome";
import type { PortalHome } from "@/lib/portal";
import { getResource } from "@/lib/server/resource";
import { portalSession } from "@/lib/server/portal";

export const metadata: Metadata = { title: "Inicio" };

export default async function PortalHomePage() {
  const session = await portalSession();
  if (!session) return null;
  const home = await getResource<PortalHome>("/portal/home", "No pudimos cargar tu portal.");
  if (!home) redirect("/salir");
  return <PortalHomeView home={home} session={session} />;
}
