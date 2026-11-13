import { ConsultModeNotice } from "@/components/ui/ConsultMode";
import { Shapes } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button } from "@/components/ui/Button";
import { ProductsTable } from "@/features/catalog/ProductsTable";
import { ProductWizardAction } from "@/features/catalog/wizard/ProductWizard";
import { getProductFormOptions, listProducts } from "@/lib/server/catalog";

export const metadata: Metadata = { title: "Productos" };

export default async function ProductosPage({ searchParams }: PageProps<"/catalogo/productos">) {
  const { nuevo } = await searchParams;
  const [products, options] = await Promise.all([listProducts(), getProductFormOptions()]);

  return (
    <>
      <PageHeader title="Productos" subtitle="Tours, excursiones, paquetes y servicios que vende tu agencia." actions={
          <>
            {options?.can_update && (
              <Button href="/catalogo/categorias" variant="secondary" icon={<Shapes size={16} />} iconOnlyOnMobile>
                Tipos y categorías
              </Button>
            )}
            {options?.can_create && <ProductWizardAction options={options} defaultOpen={nuevo === "1"} />}
          </>
        }
      />
      <ConsultModeNotice permissions={["catalog.products.create", "catalog.products.update"]} what="crear ni editar productos" />
      <ProductsTable products={products} can={{ edit: Boolean(options?.can_update), remove: Boolean(options?.can_activate) }} />
    </>
  );
}
