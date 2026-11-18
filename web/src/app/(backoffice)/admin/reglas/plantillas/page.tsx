import { BadgeCheck } from "lucide-react";
import type { Metadata } from "next";
import { TintTile } from "@/components/ui/Tinted";
import { RuleTemplatesGrid } from "@/features/admin/Rules";
import { formatDateTime } from "@/lib/format";
import { getRules } from "@/lib/server/adminSections";

export const metadata: Metadata = { title: "Plantillas por tipo de negocio" };

export default async function ReglasPlantillasPage() {
  const data = await getRules();
  if (!data) return null;
  const applied = data.template_applied;
  return (
    <>
      <section className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <TintTile icon={BadgeCheck} tone="violet" label="Plantilla aplicada" value={applied?.name ?? "Ninguna"} note={applied ? `${formatDateTime(applied.at, false)}${applied.by ? ` · ${applied.by}` : ""}` : "Configuración a medida"} info={<p>Última plantilla por tipo de negocio aplicada según la auditoría. Después puedes ajustar cada regla por separado.</p>} />
      </section>
      <RuleTemplatesGrid data={data} />
    </>
  );
}
