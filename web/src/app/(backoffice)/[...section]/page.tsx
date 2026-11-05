import { Compass } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { screenFor } from "@/config/navigation";

export default async function SectionPage({ params }: PageProps<"/[...section]">) {
  const { section } = await params;
  const href = `/${section.join("/")}`;
  const screen = screenFor(href);
  if (!screen) notFound();

  const isRecord = href !== screen.href;
  const recordCode = decodeURIComponent(section.at(-1) ?? "");

  return (
    <>
      <PageHeader title={isRecord ? recordCode : screen.label} back={isRecord ? { href: screen.href, label: screen.label } : undefined} jump={!isRecord} />
      <Card>
        <EmptyState icon={<Compass size={22} />} title="Todavía no hay nada que mostrar aquí" description="Cuando registres información en esta sección, la verás en esta pantalla." />
      </Card>
    </>
  );
}
