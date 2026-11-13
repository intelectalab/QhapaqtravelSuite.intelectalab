import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { CatalogImportBoard } from "@/features/growth/CatalogImportBoard";
import type { CatalogImportDetail, ImportsOverview } from "@/lib/growth";
import { getCachedResource, getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Importar con IA" };

export default async function ImportarPage() {
  const overview = await getCachedResource<ImportsOverview>("/catalog/imports", "No pudimos cargar las importaciones.");

  if (!overview) {
    return <PageHeader title="Importar con IA" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const pending = overview.imports.filter((row) => row.status === "revision").slice(0, 12);
  const details = (await Promise.all(pending.map((row) => getResource<CatalogImportDetail>(`/catalog/imports/${encodeURIComponent(row.code)}`, "No pudimos cargar la importación.")))).filter((detail): detail is CatalogImportDetail => detail !== null);

  return (
    <>
      <PageHeader
        title="Importar con IA"
        subtitle="Carga tu catálogo desde una página web, un PDF o una planilla, y revisa antes de crear."
        info={<InfoTip>El importador nunca publica: crea productos en borrador con la marca «Detectado por IA». Cada análisis cuenta como un pedido del cupo mensual de IA.</InfoTip>}
      />
      <CatalogImportBoard overview={overview} details={details} />
    </>
  );
}
