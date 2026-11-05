import { Compass } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { screenFor } from "@/config/navigation";
import { PLATFORM_NAV_GROUPS } from "@/config/platformNavigation";

export default async function PlatformSectionPage({ params }: PageProps<"/plataforma/[...section]">) {
  const { section } = await params;
  const screen = screenFor(`/plataforma/${section.join("/")}`, PLATFORM_NAV_GROUPS);
  if (!screen || screen.href !== `/plataforma/${section.join("/")}`) notFound();

  return (
    <>
      <PageHeader title={screen.label} />
      <Card>
        <EmptyState icon={<Compass size={22} />} title="Todavía no hay nada que mostrar aquí" description="Esta sección se habilitará en una próxima entrega de la consola." />
      </Card>
    </>
  );
}
