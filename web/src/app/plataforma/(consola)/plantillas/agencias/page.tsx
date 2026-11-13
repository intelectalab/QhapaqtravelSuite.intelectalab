import type { Metadata } from "next";
import { CardHeader } from "@/components/ui/Card";
import { AssignmentsTable } from "@/features/platform/SiteTemplatesAdmin";
import { getTemplatesAdmin } from "@/lib/server/siteTemplatesAdmin";

export const metadata: Metadata = { title: "Plantilla por agencia" };

export default async function AgenciasPage() {
  const overview = await getTemplatesAdmin();

  return (
    <>
      <CardHeader title="Plantilla por agencia" subtitle="Puede asignar una plantilla a una agencia, por ejemplo en un alta asistida. La agencia puede cambiarla después desde su panel." />
      <AssignmentsTable overview={overview} />
    </>
  );
}
