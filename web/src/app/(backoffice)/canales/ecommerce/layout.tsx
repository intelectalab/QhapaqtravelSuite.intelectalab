import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { EcommerceTiles } from "@/features/channels/Ecommerce";
import { getEcommerce } from "@/lib/server/ecommerce";

export default async function EcommerceLayout({ children }: { children: ReactNode }) {
  const { overview, promotions } = await getEcommerce();
  if (!overview) return <PageHeader title="E-commerce" subtitle="Tu rol no tiene acceso a esta sección." />;

  return (
    <>
      <PageHeader
        title="E-commerce"
        subtitle="Ventas en línea desde el sitio web y el widget: pedidos, pagos y productos a la venta."
        info={<InfoTip>Cada pedido crea su reserva y su cuenta por cobrar al primer intento de pago. Solo se anulan pedidos con el pago pendiente o rechazado.</InfoTip>}
      />
      <EcommerceTiles kpis={overview.kpis} funnel={overview.funnel} products={overview.products.length} />
      <TabbedCard
        padded={false}
        tabs={[
          { href: "/canales/ecommerce", label: "Pedidos web", count: overview.orders.length },
          { href: "/canales/ecommerce/productos", label: "Productos en la tienda", count: overview.products.length },
          ...(promotions ? [{ href: "/canales/ecommerce/promociones", label: "Promociones y códigos", count: promotions.rows.filter((row) => row.state === "vigente").length }] : []),
        ]}
      >
        {children}
      </TabbedCard>
    </>
  );
}
