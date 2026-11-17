import type { Metadata } from "next";
import { FormProtectionCard } from "@/features/platform/PlatformConnections";
import type { PlatformSettingsOverview } from "@/lib/platform";
import { platformGet } from "@/lib/server/platform";

export const metadata: Metadata = { title: "Protección de formularios" };

export default async function ProteccionDeFormulariosPage() {
  const data = await platformGet<PlatformSettingsOverview>("/settings");

  return <FormProtectionCard protection={data.sections.form_protection} version={data.lock_version} />;
}
