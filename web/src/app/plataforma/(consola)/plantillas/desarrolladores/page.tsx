import type { Metadata } from "next";
import { DeveloperGuide } from "@/features/platform/SiteTemplatesAdmin";
import { getTemplatesAdmin } from "@/lib/server/siteTemplatesAdmin";

export const metadata: Metadata = { title: "Plantillas para desarrolladores" };

export default async function DesarrolladoresPage() {
  const overview = await getTemplatesAdmin();

  return <DeveloperGuide overview={overview} />;
}
