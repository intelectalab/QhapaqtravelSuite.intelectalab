import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { ProductsTable } from "@/features/catalog/ProductsTable";
import { listProducts } from "@/lib/server/catalog";

export const metadata: Metadata = { title: "Productos" };

export default async function ProductosPage() {
  const products = await listProducts();

  return (
    <>
      <PageHeader title="Productos" subtitle="Tours, excursiones, paquetes y servicios que vende tu agencia." />
      <ProductsTable products={products} />
    </>
  );
}
