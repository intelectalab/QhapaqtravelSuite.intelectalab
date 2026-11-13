import type { Metadata } from "next";
import { CardHeader } from "@/components/ui/Card";
import { SubmissionsBoard, SubmitVersionAction } from "@/features/platform/SiteTemplatesAdmin";
import { getTemplateSubmissions, getTemplatesAdmin } from "@/lib/server/siteTemplatesAdmin";

export const metadata: Metadata = { title: "Envíos de plantillas" };

export default async function EnviosPage() {
  const [overview, submissions] = await Promise.all([getTemplatesAdmin(), getTemplateSubmissions()]);

  return (
    <>
      <CardHeader title="Envíos a revisión" subtitle="Solo se publica una versión con las validaciones en verde, Lighthouse mínimo y la revisión visual confirmada." action={<SubmitVersionAction overview={overview} />} />
      <SubmissionsBoard submissions={submissions} overview={overview} />
    </>
  );
}
