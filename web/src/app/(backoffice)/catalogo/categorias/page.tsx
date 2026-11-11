import { FolderTree, Layers, Route, Tags } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { TaxonomyBoard } from "@/features/catalog-taxonomy/TaxonomyBoard";
import type { ProductCategory, ProductType, TaxonomyOverview } from "@/lib/catalog-taxonomy";
import { getProductFormOptions } from "@/lib/server/catalog";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Tipos y categorías" };

export default async function CategoriasPage() {
  const [types, categories, options] = await Promise.all([
    getResource<ProductType[]>("/catalog/product-types", "No pudimos cargar los tipos de producto."),
    getResource<ProductCategory[]>("/catalog/categories", "No pudimos cargar las categorías."),
    getProductFormOptions(),
  ]);

  if (!types || !categories) {
    return <PageHeader title="Tipos y categorías" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const overview: TaxonomyOverview = { types, categories, can: { manage: Boolean(options?.can_update) } };
  const usedTypes = types.filter((type) => type.products.length > 0);
  const itinerary = types.filter((type) => type.requires_itinerary);
  const usedCategories = categories.filter((category) => category.products.length > 0);
  const subcategories = categories.flatMap((category) => category.subcategories);
  const idleSubs = subcategories.filter((sub) => sub.products.length === 0);
  const withoutSub = categories.reduce((sum, category) => sum + Math.max(0, category.products.length - category.subcategories.reduce((total, sub) => total + sub.products.length, 0)), 0);

  return (
    <>
      <PageHeader
        back={{ href: "/catalogo/productos", label: "Productos" }}
        title="Tipos y categorías"
        subtitle="Cómo se clasifica el catálogo de tu agencia."
        info={<InfoTip>Son propios de tu agencia. Un tipo, categoría o subcategoría en uso no se elimina y los productos conservan su clasificación cuando la renombras.</InfoTip>}
      />
      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TintTile icon={Tags} tone="t1" label="Tipos en uso" value={usedTypes.length} note={`de ${types.length} configurados`} info={<p>Tipos con al menos un producto que no está eliminado.</p>} />
        <TintTile icon={Route} tone="violet" label="Piden itinerario" value={itinerary.length} note={itinerary.length ? itinerary.map((type) => type.name.toLowerCase()).slice(0, 3).join(", ") : "Ningún tipo lo exige"} info={<p>Tipos que exigen al menos un día de itinerario en el checklist de activación del producto.</p>} />
        <TintTile icon={Layers} tone="ok" label="Categorías en uso" value={usedCategories.length} note={`de ${categories.length} · ${subcategories.length} subcategorías`} info={<p>Categorías con al menos un producto. Las subcategorías se cuentan dentro de su categoría.</p>} />
        <TintTile icon={FolderTree} tone="sun" label="Sin subcategoría" value={withoutSub} note={idleSubs.length ? `${idleSubs.length} subcategorías sin uso` : "Todas las subcategorías se usan"} info={<p>Productos que tienen categoría pero no subcategoría. Asignarla mejora los filtros del catálogo y del sitio.</p>} />
      </section>
      <TaxonomyBoard overview={overview} />
    </>
  );
}
