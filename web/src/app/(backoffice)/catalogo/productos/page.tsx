import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { ProductCreateAction } from "@/features/catalog/ProductForms";
import { ProductsTable } from "@/features/catalog/ProductsTable";
import { getProductFormOptions, listProducts } from "@/lib/server/catalog";

export const metadata: Metadata = { title: "Productos" };

export default async function ProductosPage() {
  const [products, options] = await Promise.all([listProducts(), getProductFormOptions()]);

  return (
    <>
      <PageHeader title="Productos" subtitle="Tours, excursiones, paquetes y servicios que vende tu agencia." actions={options?.can_create ? <ProductCreateAction options={options} /> : undefined} />
      <ProductsTable products={products} can={{ edit: Boolean(options?.can_update), remove: Boolean(options?.can_activate) }} />
    </>
  );
}
