import type { Metadata } from "next";
import { OutgoingMailCard } from "@/features/platform/OutgoingMail";
import type { PlatformSettingsOverview } from "@/lib/platform";
import { platformGet } from "@/lib/server/platform";

export const metadata: Metadata = { title: "Correo de salida" };

export default async function CorreoDeSalidaPage() {
  const data = await platformGet<PlatformSettingsOverview>("/settings");

  return <OutgoingMailCard mail={data.sections.outgoing_mail} version={data.lock_version} index={0} />;
}
