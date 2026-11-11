import { Crosshair, Globe2, MapPinned, Package } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { DestinationCreateAction } from "@/features/catalog-destinations/DestinationForms";
import { DestinationsExplorer } from "@/features/catalog-destinations/DestinationsExplorer";
import type { DestinationsOverview } from "@/lib/catalog-destinations";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Destinos" };

export default async function DestinosPage() {
  const overview = await getResource<DestinationsOverview>("/catalog/destinations", "No pudimos cargar los destinos.");

  if (!overview) {
    return <PageHeader title="Destinos" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const nodes = overview.destinations;
  const withProducts = nodes.filter((node) => node.direct_products > 0);
  const located = nodes.filter((node) => node.lat !== null);
  const leaves = nodes.filter((node) => ["Atracción", "Ruta", "Lugar"].includes(node.type));

  return (
    <>
      <PageHeader
        title="Destinos"
        subtitle="Dónde ocurren tus productos, del país a la atracción."
        info={<InfoTip>Al filtrar productos por un destino se incluyen sus subdestinos. Un destino con subdestinos o productos no se puede eliminar.</InfoTip>}
        actions={overview.can.manage ? <DestinationCreateAction destinations={overview.destinations} types={overview.options.types} /> : undefined}
      />
      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TintTile icon={Globe2} tone="t1" label="Destinos" value={nodes.length} note={`${nodes.filter((node) => node.depth <= 1).length} países y regiones`} info={<p>Todos los destinos del árbol, desde países hasta atracciones y rutas.</p>} />
        <TintTile icon={MapPinned} tone="sun" label="Atracciones y lugares" value={leaves.length} note="Puntos que visita el pasajero" info={<p>Destinos de tipo atracción, lugar o ruta: los puntos concretos que aparecen en los itinerarios.</p>} />
        <TintTile icon={Package} tone="ok" label="Con productos" value={withProducts.length} note="Como destino principal o secundario" info={<p>Destinos con al menos un producto asignado directamente, como destino principal o secundario. No cuenta los productos de sus subdestinos.</p>} />
        <TintTile icon={Crosshair} tone="violet" label="Con coordenadas" value={located.length} note={`${nodes.length - located.length} por ubicar en el mapa`} info={<p>Destinos con latitud y longitud cargadas, necesarias para el mapa del sitio y del portal.</p>} />
      </section>
      <DestinationsExplorer overview={overview} />
    </>
  );
}
