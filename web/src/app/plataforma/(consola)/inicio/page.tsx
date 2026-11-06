import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { PlatformHomeView } from "@/features/platform/PlatformHome";
import { currentPlatformUser } from "@/lib/server/platform";
import { getPlatformHome } from "@/lib/server/platformConsole";

export const metadata: Metadata = { title: "Inicio" };

export default async function InicioPage() {
  const [home, me] = await Promise.all([getPlatformHome(), currentPlatformUser()]);

  return (
    <>
      <PageHeader title={`Hola, ${me.name.split(" ")[0]}`} subtitle="Estado de la plataforma: agencias, ingresos y lo que necesita tu atención hoy." />
      <PlatformHomeView home={home} />
    </>
  );
}
